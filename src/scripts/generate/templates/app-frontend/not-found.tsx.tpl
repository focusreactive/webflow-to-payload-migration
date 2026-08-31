import Link from "next/link";
import React from "react";

export default function NotFound() {
  return (
    <main style={{ padding: "4rem", textAlign: "center" }}>
      <h1>404</h1>
      <p>Page not found.</p>
      <Link href="/">Go home</Link>
    </main>
  );
}
