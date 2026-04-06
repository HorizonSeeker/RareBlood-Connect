import NextAuth from "next-auth";
import { authOptions } from "../authOptions.js";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };