import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const AUTH_TOKEN_STORAGE_KEY = 'hyperautomation:auth-token'
const AUTH_SESSION_STORAGE_KEY = 'hyperautomation:auth-session'
const nativeFetch = window.fetch.bind(window)

const toRequestUrl = (input) => {
	if (typeof input === 'string') return input
	if (input instanceof URL) return input.toString()
	if (input && typeof input === 'object' && 'url' in input) return input.url
	return ''
}

const clearAuthState = () => {
	localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
	localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}

window.fetch = async (input, init = {}) => {
	const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
	const requestUrl = toRequestUrl(input)
	const isLoginRequest = requestUrl.includes('/api/auth/login')

	if (!token) {
		const response = await nativeFetch(input, init)
		if (response.status === 401 && !isLoginRequest) {
			clearAuthState()
			window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { url: requestUrl, status: 401 } }))
		}
		return response
	}

	const headers = new Headers(init.headers || {})
	if (!headers.has('Authorization')) {
		headers.set('Authorization', `Bearer ${token}`)
	}

	const response = await nativeFetch(input, { ...init, headers })
	if (response.status === 401 && !isLoginRequest) {
		clearAuthState()
		window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { url: requestUrl, status: 401 } }))
	}

	return response
}

createApp(App).mount('#app')
