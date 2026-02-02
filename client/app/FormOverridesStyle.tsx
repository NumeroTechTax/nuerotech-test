"use client";

import { useEffect } from "react";

const STYLE_ID = "form-overrides-black-text";

const css = `
  button, input, optgroup, select, textarea {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
  }
  input::placeholder, textarea::placeholder {
    color: #000000 !important;
  }
  #email, input#email, .login-email-input,
  #email:-webkit-autofill, input#email:-webkit-autofill {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
  }
  .btn-google-login, .btn-google-login * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
  }
`;

export function FormOverridesStyle() {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }, []);
  return null;
}
