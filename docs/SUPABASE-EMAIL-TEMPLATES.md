# Supabase Email Templates — Cryptex branding (OTP-only)

Copy-paste-ready HTML for the Supabase auth email templates. Cryptex's
v1 auth flow is **code-only**: every flow uses a 6-digit OTP that the
user pastes into the app. No clickable links — those have known attack
surface (corporate scanners that prefetch links and consume single-use
tokens before the user clicks; URL leak via referrer / browser history;
phishing scams that mimic legitimate links). The OTP is pasted directly,
verified server-side, and that's the entire flow.

> **OAuth (Google / GitHub) is a separate flow** — those still use
> redirects to `/auth/callback` because that's how OAuth works
> protocol-wise. The templates below cover only email-based flows
> (signup / password reset / email-change).

## How to apply

1. Supabase dashboard → **Authentication** → **Email Templates**.
2. Open each template (Confirm signup, Magic link, Invite user,
   Reset password, Change email).
3. **Replace** the entire template body with the HTML below.
4. Update the **Subject** above the body (suggestions per template).
5. **Save**.

> **Variables Supabase substitutes for you:**
> - `{{ .Token }}` — the 6-digit code (this is what we surface)
> - `{{ .Email }}` — recipient email
> - `{{ .SiteURL }}` — your configured Site URL (only used in `From:`/footer references)
>
> The templates below intentionally do NOT reference `{{ .ConfirmationURL }}`.
> Removing the link from the user-facing template is what makes the flow
> prefetch-resistant. The link still exists server-side (Supabase issues
> it) but it's never seen by anyone, so it can't be consumed in transit.

---

## 1. Confirm signup

**Subject:**
```
Your Cryptex verification code
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Cryptex verification code</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1410; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#f4ede4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1410; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; background-color:#211912; border-radius:14px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">

          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 60%, #6b8294 100%); padding: 24px 28px;">
              <div style="font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; opacity:0.85;">CRYPTEX</div>
              <div style="margin-top: 4px; font-size: 18px; font-weight:600; color:#fff7ed;">Verify your email</div>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 14px 0; font-size:14px; line-height:1.6; color:#f4ede4;">
                Use this code to finish creating your account.
              </p>

              <p style="margin: 0; padding: 16px; background-color:#1a1410; border:1px solid rgba(249,115,22,0.4); border-radius:10px; text-align:center; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-size:30px; font-weight:700; letter-spacing:0.45em; color:#f97316;">
                {{ .Token }}
              </p>

              <p style="margin: 18px 0 0 0; font-size:12px; line-height:1.6; color:#a89880;">
                Enter the code on the Cryptex sign-up screen. The code expires in <strong style="color:#f4ede4;">1 hour</strong>.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:22px 0;" />

              <p style="margin: 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                <strong style="color:#a89880;">Didn't sign up?</strong> Ignore this email — your address won't be added.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1410; padding: 14px 28px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                <a href="{{ .SiteURL }}" style="color:#f97316; text-decoration:none;">Cryptex</a> ·
                <a href="{{ .SiteURL }}/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="{{ .SiteURL }}/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
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

## 2. Magic link (sign-in code)

The "Magic Link" template is what Supabase uses for passwordless sign-in
emails. Even though Cryptex's v1 UI doesn't expose passwordless sign-in,
Supabase still uses this template for the OTP path (it's the same
`signInWithOtp` API), so we still need to brand it.

**Subject:**
```
Your Cryptex sign-in code
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Cryptex sign-in code</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1410; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#f4ede4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1410; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; background-color:#211912; border-radius:14px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">

          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 60%, #6b8294 100%); padding: 24px 28px;">
              <div style="font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; opacity:0.85;">CRYPTEX</div>
              <div style="margin-top: 4px; font-size: 18px; font-weight:600; color:#fff7ed;">Sign-in code</div>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 14px 0; font-size:14px; line-height:1.6; color:#f4ede4;">
                Your sign-in code:
              </p>

              <p style="margin: 0; padding: 16px; background-color:#1a1410; border:1px solid rgba(249,115,22,0.4); border-radius:10px; text-align:center; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-size:30px; font-weight:700; letter-spacing:0.45em; color:#f97316;">
                {{ .Token }}
              </p>

              <p style="margin: 18px 0 0 0; font-size:12px; line-height:1.6; color:#a89880;">
                Enter the code on the Cryptex sign-in screen. The code expires in <strong style="color:#f4ede4;">1 hour</strong>.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:22px 0;" />

              <p style="margin: 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                <strong style="color:#a89880;">Didn't request this?</strong> You can safely ignore this email — no one signed in.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1410; padding: 14px 28px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                <a href="{{ .SiteURL }}" style="color:#f97316; text-decoration:none;">Cryptex</a> ·
                <a href="{{ .SiteURL }}/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="{{ .SiteURL }}/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
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
Your Cryptex password reset code
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Cryptex password reset code</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1410; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#f4ede4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1410; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; background-color:#211912; border-radius:14px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">

          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 60%, #6b8294 100%); padding: 24px 28px;">
              <div style="font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; opacity:0.85;">CRYPTEX</div>
              <div style="margin-top: 4px; font-size: 18px; font-weight:600; color:#fff7ed;">Password reset</div>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 14px 0; font-size:14px; line-height:1.6; color:#f4ede4;">
                Someone — hopefully you — asked to reset your Cryptex password.
              </p>

              <p style="margin: 0; padding: 16px; background-color:#1a1410; border:1px solid rgba(249,115,22,0.4); border-radius:10px; text-align:center; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-size:30px; font-weight:700; letter-spacing:0.45em; color:#f97316;">
                {{ .Token }}
              </p>

              <p style="margin: 18px 0 0 0; font-size:12px; line-height:1.6; color:#a89880;">
                Enter the code on the password reset screen. The code expires in <strong style="color:#f4ede4;">1 hour</strong>.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:22px 0;" />

              <p style="margin: 0 0 6px 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                <strong style="color:#a89880;">Didn't request this?</strong> Your password is unchanged — no action needed.
              </p>
              <p style="margin: 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                Anyone with this code can reset your password. Don't share it.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1410; padding: 14px 28px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                <a href="{{ .SiteURL }}" style="color:#f97316; text-decoration:none;">Cryptex</a> ·
                <a href="{{ .SiteURL }}/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="{{ .SiteURL }}/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
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
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; background-color:#211912; border-radius:14px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">

          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 60%, #6b8294 100%); padding: 24px 28px;">
              <div style="font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; opacity:0.85;">CRYPTEX</div>
              <div style="margin-top: 4px; font-size: 18px; font-weight:600; color:#fff7ed;">You're invited</div>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 14px 0; font-size:14px; line-height:1.6; color:#f4ede4;">
                You've been invited to <strong style="color:#f97316;">Cryptex</strong>. Use this code on the sign-up screen to claim your account.
              </p>

              <p style="margin: 0; padding: 16px; background-color:#1a1410; border:1px solid rgba(249,115,22,0.4); border-radius:10px; text-align:center; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-size:30px; font-weight:700; letter-spacing:0.45em; color:#f97316;">
                {{ .Token }}
              </p>

              <p style="margin: 18px 0 0 0; font-size:12px; line-height:1.6; color:#a89880;">
                Code expires in 1 hour.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:22px 0;" />

              <p style="margin: 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                Not expecting this? Ignore the email — no account is created until you enter the code.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1410; padding: 14px 28px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                <a href="{{ .SiteURL }}" style="color:#f97316; text-decoration:none;">Cryptex</a> ·
                <a href="{{ .SiteURL }}/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="{{ .SiteURL }}/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
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
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; background-color:#211912; border-radius:14px; overflow:hidden; border:1px solid rgba(244,237,228,0.06);">

          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #d97706 60%, #6b8294 100%); padding: 24px 28px;">
              <div style="font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#fff7ed; opacity:0.85;">CRYPTEX</div>
              <div style="margin-top: 4px; font-size: 18px; font-weight:600; color:#fff7ed;">Confirm new email</div>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 14px 0; font-size:14px; line-height:1.6; color:#f4ede4;">
                You asked to change the email address on your <strong style="color:#f97316;">Cryptex</strong> account to this one.
              </p>

              <p style="margin: 0; padding: 16px; background-color:#1a1410; border:1px solid rgba(249,115,22,0.4); border-radius:10px; text-align:center; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-size:30px; font-weight:700; letter-spacing:0.45em; color:#f97316;">
                {{ .Token }}
              </p>

              <p style="margin: 18px 0 0 0; font-size:12px; line-height:1.6; color:#a89880;">
                Enter the code on the email-change confirmation screen.
              </p>

              <hr style="border:none; border-top:1px solid rgba(244,237,228,0.08); margin:22px 0;" />

              <p style="margin: 0; font-size:12px; line-height:1.6; color:#7d6d54;">
                <strong style="color:#a89880;">Didn't request this?</strong> The change won't take effect unless you confirm. If this is unexpected, sign in and review your account security.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1410; padding: 14px 28px; border-top:1px solid rgba(244,237,228,0.06);">
              <p style="margin: 0; font-size:11px; line-height:1.5; color:#7d6d54; text-align:center;">
                <a href="{{ .SiteURL }}" style="color:#f97316; text-decoration:none;">Cryptex</a> ·
                <a href="{{ .SiteURL }}/privacy/" style="color:#7d6d54; text-decoration:underline;">Privacy</a> ·
                <a href="{{ .SiteURL }}/terms/" style="color:#7d6d54; text-decoration:underline;">Terms</a>
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

## How to make emails come from YOUR domain (not noreply@supabase.co)

By default, Supabase sends auth emails through a shared mailer with a
`noreply@mail.app.supabase.io` (or similar) sender. That's a free-tier
shared service — fine for testing, terrible for production deliverability
and brand. Real users see "Supabase" as the sender, not Cryptex.

**Fix: use a transactional SMTP provider on your own domain.**

The full setup walkthrough is in [`DEPLOY-OAUTH-AND-EMAIL.md`](DEPLOY-OAUTH-AND-EMAIL.md)
Part A — it uses Resend (free tier covers 100 emails/day) and takes
~10 minutes. Once configured:

1. The `From:` header on every Cryptex auth email becomes
   `Cryptex <noreply@your-domain.com>` — the user sees your domain, not
   Supabase's.
2. SPF + DKIM are signed by your domain → emails land in inbox, not spam.
3. Delivery is instant (under 5 seconds) instead of 30s+.
4. Rate-limit caps move out of the way (3-4 / hour shared → 100 / day
   on your own SMTP, or higher on a paid tier).

The two values that drive the `From:` line are set in **Supabase →
Project Settings → Authentication → SMTP Settings**:

```
Sender email:  noreply@your-domain.com
Sender name:   Cryptex
```

Once those are saved + the SMTP host/credentials are pointing at Resend
(or any other transactional provider), all the templates above will be
delivered from your domain.

---

## Notes on email-client rendering

| Client | Renders correctly? | Notes |
|---|---|---|
| Gmail (web, dark mode) | ✅ | Color inversion preserves orange/cream accents |
| Gmail (web, light mode) | ✅ | Card sits on a dark background — looks like a branded panel |
| Apple Mail (macOS / iOS) | ✅ | Full fidelity, gradients render |
| Outlook 365 (web) | ✅ | Slight color shift on the gradient banner; readable |
| Outlook 2019 (desktop) | ⚠️ | Linear gradient may fall back to solid orange — fine, just less depth |
| ProtonMail | ✅ | Strict CSP but inline styles work |
| Yahoo Mail | ✅ | Works |

If you need ironclad cross-Outlook fidelity, replace the
`background: linear-gradient(...)` on the banner cell with a solid
`#f97316`. Everything else degrades gracefully on its own.
