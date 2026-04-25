export interface Contact {
  id: string
  name: string
  email: string
  connectionStrength: "Very weak" | "Weak" | "Good" | "Very strong"
  twitterFollowers: number
  description?: string
}
