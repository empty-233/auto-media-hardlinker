export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
}

export interface UserInfo {
  id: number
  username: string
  createdAt?: string
}

export interface InitializationStatus {
  needsInitialization: boolean
  userCount: number
}
