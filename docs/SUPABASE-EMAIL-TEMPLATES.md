# Supabase Email Templates — Cryptex branding

Copy-paste-ready HTML for the 5 Supabase auth email templates. They
render the Cryptex wordmark + logo, follow the dark/orange theme, and
degrade gracefully on email clients that strip CSS or block images.

## How to apply

1. In Supabase dashboard → **Authentication** → **Email Templates**.
2. Click each template (Confirm signup, Magic link, Invite user, Reset
   password, Change email).
3. Paste the full HTML from below into the template body.
4. Update the **Subject** line above the body (suggestions in each
   section).
5. Click **Save**.

> **Variables Supabase substitutes for you:**
> - `{{ .ConfirmationURL }}` — the click-through link (single-use, can be consumed by email scanners)
> - `{{ .Token }}` — **6-digit OTP code** (prefetch-resistant — the user pastes this into Cryptex's `/login` or `/signup` "Enter code" field)
> - `{{ .TokenHash }}` — hashed token (rarely used)
> - `{{ .SiteURL }}` — your configured Site URL from URL Configuration
> - `{{ .Email }}` — recipient's email
> - `{{ .Data }}` — custom user metadata (rarely used)

## Why the templates show BOTH a code and a link

Cryptex's auth flow now supports OTP code entry as a parallel path to the
clickable link. **This matters in production** because corporate email
security scanners (Outlook Safe Links, Gmail link-protection, antivirus
link-scanners) HEAD-request URLs in emails to scan for malware. That
prefetch consumes Supabase's single-use `?token=…` parameter — when the
human user clicks the link a moment later, Supabase responds "Email link
is invalid or has expired" because the token is already burned.

The 6-digit OTP code in `{{ .Token }}` is **prefetch-resistant**:
scanners can't extract it because it's only displayed in the email body,
not embedded in a URL. Users who hit the prefetcher problem just open
the email, copy the code, and paste it into Cryptex.

**Every template below now displays the OTP code prominently — keep it
that way.** Removing `{{ .Token }}` re-introduces the silent failure
mode for users on corporate email.

> **Branding placeholders to replace before saving:**
> Each template references `https://cryptex.your-domain.com` in two or
> three spots. **Find-and-replace** that with your actual deployed URL
> before saving. (Use Ctrl+H in your IDE on the snippet, then paste.)

> **Why no external image:** Email clients (especially Outlook, dark-mode
> Gmail) treat external images inconsistently. The wordmark below uses
> inline-styled HTML rendering of the brand — works everywhere, never
> blocked. If you want the actual SVG mark, host it at
> `https://cryptex.your-domain.com/cryptex-mark.png` (a 64×64 PNG export
> of `app/src/lib/components/brand/Logo.svelte`) and uncomment the
> `<img>` tag at the top of each template — fall-back text already in
> place.

---

## 1. Confirm signup

**Subject:**
```
Confirm your Cryptex account
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirm your Cryptex account</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1410; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#f4ede4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1410; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:#211912; border-radius:16px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">
          <!-- Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 50%, #6b8294 100%); padding: 36px 32px; text-align:center;">
              <!-- Brand wordmark -->
              <div style="display:inline-block; padding: 6px 14px; background: rgba(0,0,0,0.18); border-radius: 999px; font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; font-weight:600;">
                CRYPTEX · text lab
              </div>
              <h1 style="margin: 18px 0 0 0; font-size: 28px; line-height: 1.2; color:#fff7ed; font-weight:700; letter-spacing:-0.02em;">
                Confirm your account
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size:15px; line-height:1.6; color:#f4ede4;">
                Welcome to <strong style="color:#f97316;">Cryptex</strong> — the AI red-teamer's text lab.
              </p>

              <!-- 6-digit code block — prefetch-resistant primary path. -->
              <p style="margin: 0 0 8px 0; font-size:13px; line-height:1.6; color:#a89880;">
                Your verification code:
              </p>
              <p style="margin: 0 0 18px 0; padding: 14px 16px; background-color:#1a1410; border:1px solid rgba(249,115,22,0.4); border-radius:10px; text-align:center; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-size:28px; font-weight:700; letter-spacing:0.4em; color:#f97316;">
                {{ .Token }}
              </p>
              <p style="margin: 0 0 24px 0; font-size:13px; line-height:1.6; color:#f4ede4;">
                Paste this code on the Cryptex sign-in screen to finish creating your account.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:24px 0;" />

              <!-- Fallback link — works in browsers where prefetchers haven't consumed the token. -->
              <p style="margin: 0 0 12px 0; font-size:13px; line-height:1.6; color:#a89880;">
                Or click this button:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 18px 0;">
                <tr>
                  <td style="border-radius: 10px; background-color:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.4);">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block; padding: 11px 24px; font-size:14px; font-weight:600; color:#f97316; text-decoration:none; border-radius:10px;">
                      Confirm via link
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px 0; font-size:11px; line-height:1.5; color:#7d6d54;">
                Some corporate email scanners open links automatically and that can break the link. If you see "Email link is invalid or has expired", paste the 6-digit code above instead.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:24px 0;" />

              <p style="margin: 0 0 8px 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                <strong style="color:#a89880;">Didn't sign up?</strong> Ignore this email — your address won't be added.
              </p>
              <p style="margin: 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                Code and link expire in 1 hour.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1a1410; padding: 18px 32px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                Sent by <a href="https://cryptex.your-domain.com" style="color:#f97316; text-decoration:none;">Cryptex</a> · local-first, BYOK ·
                <a href="https://cryptex.your-domain.com/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="https://cryptex.your-domain.com/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Magic link (passwordless sign-in)

**Subject:**
```
Your Cryptex magic link
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Cryptex magic link</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1410; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#f4ede4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1410; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:#211912; border-radius:16px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">
          <!-- Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 50%, #6b8294 100%); padding: 36px 32px; text-align:center;">
              <div style="display:inline-block; padding: 6px 14px; background: rgba(0,0,0,0.18); border-radius: 999px; font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; font-weight:600;">
                CRYPTEX · sign-in
              </div>
              <h1 style="margin: 18px 0 0 0; font-size: 28px; line-height: 1.2; color:#fff7ed; font-weight:700; letter-spacing:-0.02em;">
                Your magic link
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size:15px; line-height:1.6; color:#f4ede4;">
                Sign in to <strong style="color:#f97316;">Cryptex</strong>. No password required.
              </p>

              <p style="margin: 0 0 8px 0; font-size:13px; line-height:1.6; color:#a89880;">
                Your sign-in code:
              </p>
              <p style="margin: 0 0 18px 0; padding: 14px 16px; background-color:#1a1410; border:1px solid rgba(249,115,22,0.4); border-radius:10px; text-align:center; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-size:28px; font-weight:700; letter-spacing:0.4em; color:#f97316;">
                {{ .Token }}
              </p>
              <p style="margin: 0 0 24px 0; font-size:13px; line-height:1.6; color:#f4ede4;">
                Paste this on the Cryptex sign-in screen to complete sign-in.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:24px 0;" />

              <p style="margin: 0 0 12px 0; font-size:13px; line-height:1.6; color:#a89880;">
                Or click this button:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 18px 0;">
                <tr>
                  <td style="border-radius: 10px; background-color:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.4);">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block; padding: 11px 24px; font-size:14px; font-weight:600; color:#f97316; text-decoration:none; border-radius:10px;">
                      Sign in via link
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px 0; font-size:11px; line-height:1.5; color:#7d6d54;">
                Some corporate email scanners open links automatically and that can break the link. If you see "Email link is invalid or has expired", paste the 6-digit code above instead.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:24px 0;" />

              <p style="margin: 0 0 8px 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                <strong style="color:#a89880;">Didn't request this?</strong> Someone may have typed your email by mistake. You can safely ignore this — no one signed in.
              </p>
              <p style="margin: 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                Single-use code · expires in 60 minutes.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1410; padding: 18px 32px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                <a href="https://cryptex.your-domain.com" style="color:#f97316; text-decoration:none;">Cryptex</a> · local-first, BYOK ·
                <a href="https://cryptex.your-domain.com/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="https://cryptex.your-domain.com/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Reset password

**Subject:**
```
Reset your Cryptex password
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reset your Cryptex password</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1410; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#f4ede4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1410; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:#211912; border-radius:16px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 50%, #6b8294 100%); padding: 36px 32px; text-align:center;">
              <div style="display:inline-block; padding: 6px 14px; background: rgba(0,0,0,0.18); border-radius: 999px; font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; font-weight:600;">
                CRYPTEX · password reset
              </div>
              <h1 style="margin: 18px 0 0 0; font-size: 28px; line-height: 1.2; color:#fff7ed; font-weight:700; letter-spacing:-0.02em;">
                Reset your password
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size:15px; line-height:1.6; color:#f4ede4;">
                Someone — hopefully you — asked to reset the password on your <strong style="color:#f97316;">Cryptex</strong> account.
              </p>

              <p style="margin: 0 0 8px 0; font-size:13px; line-height:1.6; color:#a89880;">
                Your reset code:
              </p>
              <p style="margin: 0 0 18px 0; padding: 14px 16px; background-color:#1a1410; border:1px solid rgba(249,115,22,0.4); border-radius:10px; text-align:center; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-size:28px; font-weight:700; letter-spacing:0.4em; color:#f97316;">
                {{ .Token }}
              </p>
              <p style="margin: 0 0 24px 0; font-size:13px; line-height:1.6; color:#f4ede4;">
                Enter this code on the password reset screen to set a new password.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:24px 0;" />

              <p style="margin: 0 0 12px 0; font-size:13px; line-height:1.6; color:#a89880;">
                Or click this button:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 18px 0;">
                <tr>
                  <td style="border-radius: 10px; background-color:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.4);">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block; padding: 11px 24px; font-size:14px; font-weight:600; color:#f97316; text-decoration:none; border-radius:10px;">
                      Reset via link
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px 0; font-size:11px; line-height:1.5; color:#7d6d54;">
                Some corporate email scanners open links automatically and that can break the link. If you see "Email link is invalid or has expired", paste the 6-digit code above instead.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:24px 0;" />

              <p style="margin: 0 0 8px 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                <strong style="color:#a89880;">Didn't request this?</strong> Your password is unchanged. You can ignore this email.
              </p>
              <p style="margin: 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                Single-use code · expires in 60 minutes. Anyone with this code can change your password — keep it private.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1410; padding: 18px 32px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                <a href="https://cryptex.your-domain.com" style="color:#f97316; text-decoration:none;">Cryptex</a> ·
                <a href="https://cryptex.your-domain.com/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="https://cryptex.your-domain.com/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4. Invite user

**Subject:**
```
You've been invited to Cryptex
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>You've been invited to Cryptex</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1410; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#f4ede4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1410; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:#211912; border-radius:16px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 50%, #6b8294 100%); padding: 36px 32px; text-align:center;">
              <div style="display:inline-block; padding: 6px 14px; background: rgba(0,0,0,0.18); border-radius: 999px; font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; font-weight:600;">
                CRYPTEX · invite
              </div>
              <h1 style="margin: 18px 0 0 0; font-size: 28px; line-height: 1.2; color:#fff7ed; font-weight:700; letter-spacing:-0.02em;">
                You're invited
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size:15px; line-height:1.6; color:#f4ede4;">
                You've been invited to <strong style="color:#f97316;">Cryptex</strong>, an AI red-teamer's text lab — 162 transforms, 36 mutators, 26 specialized red-team workbenches, and a dataset pipeline. Everything runs in your browser; bring your own provider key.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="border-radius: 10px; background-color:#f97316;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block; padding: 13px 28px; font-size:15px; font-weight:600; color:#1a1410; text-decoration:none; border-radius:10px;">
                      Accept invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px 0; font-size:13px; line-height:1.6; color:#a89880;">
                Or paste this into your browser:
              </p>
              <p style="margin: 0 0 24px 0; font-size:12px; line-height:1.5; word-break:break-all; color:#7d6d54; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; background-color:#1a1410; padding:10px 12px; border-radius:6px; border:1px solid rgba(244,237,228,0.05);">
                {{ .ConfirmationURL }}
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:24px 0;" />

              <p style="margin: 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                Not expecting this? Just ignore the email — no account is created until you click the link.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1410; padding: 18px 32px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                <a href="https://cryptex.your-domain.com" style="color:#f97316; text-decoration:none;">Cryptex</a> ·
                <a href="https://cryptex.your-domain.com/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="https://cryptex.your-domain.com/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 5. Change email address

**Subject:**
```
Confirm your new Cryptex email
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirm your new Cryptex email</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1410; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#f4ede4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1410; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:#211912; border-radius:16px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 50%, #6b8294 100%); padding: 36px 32px; text-align:center;">
              <div style="display:inline-block; padding: 6px 14px; background: rgba(0,0,0,0.18); border-radius: 999px; font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; font-weight:600;">
                CRYPTEX · email change
              </div>
              <h1 style="margin: 18px 0 0 0; font-size: 28px; line-height: 1.2; color:#fff7ed; font-weight:700; letter-spacing:-0.02em;">
                Confirm new email
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size:15px; line-height:1.6; color:#f4ede4;">
                You asked to change the email address on your <strong style="color:#f97316;">Cryptex</strong> account to this one. Tap below to confirm.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="border-radius: 10px; background-color:#f97316;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block; padding: 13px 28px; font-size:15px; font-weight:600; color:#1a1410; text-decoration:none; border-radius:10px;">
                      Confirm email →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px 0; font-size:13px; line-height:1.6; color:#a89880;">
                Or paste this into your browser:
              </p>
              <p style="margin: 0 0 24px 0; font-size:12px; line-height:1.5; word-break:break-all; color:#7d6d54; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; background-color:#1a1410; padding:10px 12px; border-radius:6px; border:1px solid rgba(244,237,228,0.05);">
                {{ .ConfirmationURL }}
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:24px 0;" />

              <p style="margin: 0 0 8px 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                <strong style="color:#a89880;">Didn't request this?</strong> The change won't go through unless you confirm. If this is unexpected, sign in and review your account security.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1410; padding: 18px 32px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                <a href="https://cryptex.your-domain.com" style="color:#f97316; text-decoration:none;">Cryptex</a> ·
                <a href="https://cryptex.your-domain.com/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="https://cryptex.your-domain.com/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Notes on email-client rendering

| Client | Renders correctly? | Notes |
|---|---|---|
| Gmail (web, dark mode) | ✅ | Gmail's dark-mode color inversion preserves orange/cream accents |
| Gmail (web, light mode) | ✅ | Card sits on a dark background — looks like a "branded" panel |
| Apple Mail (macOS / iOS) | ✅ | Full fidelity, gradients render |
| Outlook 365 (web) | ✅ | Slight color shift in gradient (Outlook prefers solid colors), still readable |
| Outlook 2019 (desktop) | ⚠️ | Linear gradient may fall back to solid `#f97316` orange — fine, just less visual depth |
| ProtonMail | ✅ | Strict CSP but inline styles work fine |
| Yahoo Mail | ✅ | Works |

If you need ironclad cross-Outlook fidelity, replace
`background: linear-gradient(...)` with a solid color (e.g. `#f97316`)
in the banner — every other styling rule degrades gracefully on its own.

---

## Optional: host the brand mark as PNG

For email clients that support remote images (most modern ones), you
can replace the wordmark `<div>` block with an actual logo image. Steps:

1. Export `app/src/lib/components/brand/Logo.svelte` to PNG at 96×96
   (use any browser screenshot, or `npx svg2png`).
2. Drop it at `app/static/cryptex-mark.png` (commit, push, Dokploy
   rebuilds; file appears at `https://cryptex.your-domain.com/cryptex-mark.png`).
3. In each template's banner cell, **above** the wordmark `<div>`, add:
   ```html
   <img src="https://cryptex.your-domain.com/cryptex-mark.png"
        width="56" height="56" alt="Cryptex"
        style="display:block; margin: 0 auto 12px; border:0;" />
   ```
4. Save each template in Supabase.

The wordmark text `<div>` stays as the fallback for clients that block
images — readers always see "CRYPTEX" branding either way.
