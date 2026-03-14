import argparse
import asyncio
import json
import random

import websockets


async def run_client(client_index: int, url: str, messages: int, interval: float) -> None:
    client_name = f"client-{client_index}"
    merged_id = f"device-{client_index % 2}"

    async with websockets.connect(url) as ws:
        welcome = await ws.recv()
        print(f"[{client_name}] welcome: {welcome}")

        for seq in range(messages):
            payload = {
                "id": merged_id,
                "client": client_name,
                "seq": seq,
                "temperature": random.randint(20, 35),
                "status": "ok",
            }
            await ws.send(json.dumps(payload, ensure_ascii=False))
            response = await ws.recv()
            print(f"[{client_name}] send: {payload}")
            print(f"[{client_name}] ack(updated): {response}")
            await asyncio.sleep(interval)

        while True:
            try:
                event = await asyncio.wait_for(ws.recv(), timeout=5)
                print(f"[{client_name}] event: {event}")
            except asyncio.TimeoutError:
                break


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="ws://localhost:8081")
    parser.add_argument("--clients", type=int, default=3)
    parser.add_argument("--messages", type=int, default=3)
    parser.add_argument("--interval", type=float, default=0.5)
    args = parser.parse_args()

    tasks = [
        run_client(i, args.url, args.messages, args.interval)
        for i in range(args.clients)
    ]
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())
