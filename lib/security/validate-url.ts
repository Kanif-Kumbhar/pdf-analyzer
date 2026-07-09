import dns from "dns";
import net from "net";
import { isSafeIp } from "./ip-policy";
import { AppError } from "../errors/app-error";

// Validate URL against common SSRF vectors (protocol, credentials, resolved IPs).
export async function validateUrl(urlStr: string): Promise<URL> {
  let url: URL;

  // 1. Parse URL
  try {
    url = new URL(urlStr);
  } catch {
    throw AppError.invalidUrl("Please enter a valid HTTP or HTTPS URL.");
  }

  // 2. Restrict protocol
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw AppError.unsafeUrl(`Forbidden protocol "${protocol}". Only HTTP and HTTPS protocols are permitted.`);
  }

  // 3. Reject credentials (SSRF vectors like http://user:pass@localhost)
  if (url.username || url.password) {
    throw AppError.unsafeUrl("URLs containing user credentials (username or password) are not permitted.");
  }

  const hostname = url.hostname;
  if (!hostname) {
    throw AppError.invalidUrl("URL must contain a valid hostname.");
  }

  // 4. Resolve hostname / inspect IPs
  if (net.isIP(hostname) !== 0) {
    // Hostname is directly an IP address
    if (!isSafeIp(hostname)) {
      throw AppError.unsafeUrl(`Access to private, loopback, or reserved IP address "${hostname}" is forbidden.`);
    }
  } else {
    // Hostname is a domain name. Resolve all associated IP addresses (IPv4 & IPv6).
    let addresses: dns.LookupAddress[] = [];
    try {
      addresses = await dns.promises.lookup(hostname, { all: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw AppError.pdfNotFound(`Failed to resolve host "${hostname}": ${msg}`);
    }

    if (addresses.length === 0) {
      throw AppError.pdfNotFound(`Hostname "${hostname}" resolved to no IP addresses.`);
    }

    // Inspect every resolved IP address
    for (const addr of addresses) {
      if (!isSafeIp(addr.address)) {
        throw AppError.unsafeUrl(
          `Domain "${hostname}" resolved to a forbidden private, loopback, or reserved IP address: ${addr.address}`
        );
      }
    }
  }

  return url;
}
