"use client";

import { useId, useRef, useState, type InputHTMLAttributes, type Ref } from "react";

/**
 * Password fields for every form that takes one (the admin's users, the
 * members' sign-up and reset): an eye to show what was typed, and a repeat
 * field that must match before the form submits. Unstyled apart from the
 * eye's place, so the admin (Tailwind) and a site (its own CSS) both pass
 * their classes. The server checks the repeat as well; this saves a round trip.
 */

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { ref?: Ref<HTMLInputElement> };

const MISMATCH = "De twee wachtwoorden zijn niet gelijk.";

function Eye({ crossed }: { crossed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** A password input with an eye button that shows or hides what was typed. */
export function PasswordInput({ className, style, ref, ...props }: InputProps) {
  const [shown, setShown] = useState(false);
  return (
    <span style={{ position: "relative", display: "block" }}>
      <input ref={ref} {...props} type={shown ? "text" : "password"} className={className} style={{ ...style, width: "100%", paddingRight: 40, boxSizing: "border-box" }} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
        aria-pressed={shown}
        title={shown ? "Verbergen" : "Tonen"}
        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "grid", placeItems: "center", width: 30, height: 30, border: 0, background: "transparent", color: "inherit", opacity: 0.7, cursor: "pointer", padding: 0 }}
      >
        <Eye crossed={shown} />
      </button>
    </span>
  );
}

/**
 * A new password twice. The repeat is checked while typing: a mismatch shows
 * a line under it and blocks the submit (`setCustomValidity`). With
 * `optional`, both may stay empty (the admin then generates one); once the
 * first is filled, the repeat is required.
 */
export function NewPasswordFields({
  name = "password",
  confirmName = "confirm",
  label = "Wachtwoord",
  confirmLabel = "Herhaal wachtwoord",
  hint,
  minLength,
  optional = false,
  placeholder,
  inputClassName,
  labelClassName,
  labelTextClassName,
  hintClassName,
  errorClassName,
}: {
  name?: string;
  confirmName?: string;
  label?: string;
  confirmLabel?: string;
  hint?: string;
  minLength?: number;
  optional?: boolean;
  placeholder?: string;
  inputClassName?: string;
  /** The class of each <label> (a site's form styles hang on it). */
  labelClassName?: string;
  /** The class of the label's text, when the form styles it apart (the admin's small caps). */
  labelTextClassName?: string;
  hintClassName?: string;
  errorClassName?: string;
}) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const repeat = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const mismatch = second !== "" && first !== second;
  const check = (a: string, b: string) => repeat.current?.setCustomValidity(a !== b && (a !== "" || b !== "") ? MISMATCH : "");

  return (
    <>
      <label className={labelClassName}>
        <span className={labelTextClassName}>{label}</span>
        <PasswordInput
          name={name}
          autoComplete="new-password"
          required={!optional}
          minLength={minLength}
          placeholder={placeholder}
          className={inputClassName}
          value={first}
          onChange={(e) => {
            setFirst(e.target.value);
            check(e.target.value, second);
          }}
        />
        {hint && <small className={hintClassName}>{hint}</small>}
      </label>
      <label className={labelClassName}>
        <span className={labelTextClassName}>{confirmLabel}</span>
        <PasswordInput
          ref={repeat}
          name={confirmName}
          autoComplete="new-password"
          required={!optional || first !== ""}
          className={inputClassName}
          value={second}
          aria-invalid={mismatch || undefined}
          aria-describedby={mismatch ? errorId : undefined}
          onChange={(e) => {
            setSecond(e.target.value);
            check(first, e.target.value);
          }}
        />
        {mismatch && (
          <small id={errorId} className={errorClassName} role="alert">
            {MISMATCH}
          </small>
        )}
      </label>
    </>
  );
}
