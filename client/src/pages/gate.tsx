/**
 * Gate — the door to the Office.
 *
 * Single passphrase field. No "forgot password" — there's nothing to
 * recover. If James forgets it, he changes the env var and redeploys.
 * No identity. Just a shared key.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { apiRequest, setOfficePassphrase } from "@/lib/queryClient";

export default function GatePage({ onEnter }: { onEnter: (pass: string) => void }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    // Forgive common iOS / paste mishaps:
    // - leading/trailing whitespace (auto-keyboard adds spaces, paste
    //   sometimes drags a trailing newline)
    // - smart quotes / smart hyphens that iOS substitutes when not in a
    //   monospace context. We force-replace those back to plain ASCII.
    // - lowercase mismatch (iOS auto-capitalizes the first char of a
    //   field by default; the configured key is all lowercase).
    const cleaned = pass
      .trim()
      .replace(/[\u2010-\u2015\u2212]/g, "-") // any unicode dash → plain hyphen
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .toLowerCase();
    if (!cleaned) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: cleaned }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error === "office not configured" ? "office isn't configured yet" : "wrong key");
        setLoading(false);
        return;
      }
      setOfficePassphrase(cleaned);
      onEnter(cleaned);
    } catch (err: any) {
      setError(err?.message || "couldn't reach the office");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <DoorMark />
          <h1 className="mt-6 text-2xl font-medium tracking-tight">the office</h1>
          <p className="mt-2 text-sm text-muted-foreground">james + computer · back room</p>
        </div>
        <div className="space-y-3">
          <Input
            // type='text' deliberately, NOT 'password'. iOS Safari treats
            // password fields as targets for AutoFill / Passkeys / iCloud
            // Keychain, which can cause the keyboard to never open and silently
            // inject saved values instead of what the user types. The office
            // key is a low-stakes shared phrase, not a personal credential, so
            // the right tradeoff is text field + visible characters.
            type="text"
            autoFocus
            placeholder="key"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            disabled={loading}
            data-testid="input-key"
            className="h-11 font-mono tracking-wider"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            // Tell every form-fill system to leave this alone.
            autoComplete="off"
            name="office-key"
            data-form-type="other"
            data-lpignore="true"
          />
          {error && (
            <p className="text-xs text-destructive font-mono" data-testid="text-error">
              {error}
            </p>
          )}
          <Button
            onClick={submit}
            disabled={loading || !pass}
            className="w-full h-11"
            data-testid="button-enter"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "enter"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DoorMark() {
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12 mx-auto" aria-hidden>
      <rect x="14" y="6" width="36" height="56" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="20" y="14" width="24" height="22" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="40" cy="36" r="1.5" fill="hsl(36 95% 55%)" />
      <line x1="14" y1="62" x2="50" y2="62" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
