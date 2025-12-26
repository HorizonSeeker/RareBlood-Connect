"use client"
import { SessionProvider } from "next-auth/react"
import FCMRegister from './FCMRegister'

export default function SessionWrapper({children, session}) {
  return (
    <SessionProvider session={session}>
      {children}
      <FCMRegister />
    </SessionProvider>
  )
}