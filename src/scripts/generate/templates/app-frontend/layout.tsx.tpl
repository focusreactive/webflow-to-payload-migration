import React from "react";

import "./globals.css";
__HEADER_IMPORT__
__FOOTER_IMPORT__

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        __HEADER_JSX__
        <main>{children}</main>
        __FOOTER_JSX__
      </body>
    </html>
  );
}
