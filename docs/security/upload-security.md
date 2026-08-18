# Vehicle photo upload security

## Scope

Bucket: `vehicle-photos`

The bucket stores seller vehicle photographs, including photographs of useful documents. It is not a general-purpose document bucket.

## Trust boundary

Client-side `accept="image/*"` and browser image compression improve UX but are bypassable. They are not security controls.

The Supabase Storage bucket configuration is the enforcement boundary for object size and MIME type. Storage RLS remains the authorization boundary for object ownership/access.

## Controls

- Bucket remains private (`public = false`).
- Maximum object size: **10 MiB**.
- Allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/heic`
  - `image/heif`
- SVG, PDF, GIF, executable/binary and arbitrary MIME uploads are not accepted by this bucket.
- Existing object path ownership policies remain unchanged.
- Browser compression continues to target approximately 1.2 MB images but is treated only as an optimization.

## Rationale

The 10 MiB ceiling leaves headroom for modern phone-camera originals when browser compression fails while preventing unbounded object uploads. HEIC/HEIF are retained for mobile compatibility. SVG is intentionally excluded because it is an active-content format and is not needed for vehicle photography.

## Acceptance criteria

1. `vehicle-photos.public = false`.
2. `vehicle-photos.file_size_limit = 10485760`.
3. `allowed_mime_types` contains only the approved image MIME types above.
4. Existing seller storage ownership RLS policies remain unchanged.
5. Existing photos remain readable by their authorized owner paths.
6. Application build remains green.

## Residual risk

MIME allowlisting does not perform malware/content inspection. For this private image-only bucket, the immediate control objective is type/size restriction plus access control. If Wilmet later accepts PDFs or office documents, they should use a separate document pipeline with its own allowlist, size limits and malware-scanning/quarantine process.
