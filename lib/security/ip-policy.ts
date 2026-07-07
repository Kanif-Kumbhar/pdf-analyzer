import net from "net";

/**
 * Validates if an IPv4 address is safe (not loopback, private range, link-local, multicast, or unspecified).
 */
export function isSafeIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN) || parts.some((p) => p < 0 || p > 255)) {
    return false;
  }

  const [b0, b1, b2, b3] = parts;

  // 0.0.0.0/8 (Current network / Broadcast placeholder)
  if (b0 === 0) return false;

  // 10.0.0.0/8 (Private network Class A)
  if (b0 === 10) return false;

  // 127.0.0.0/8 (Loopback addresses)
  if (b0 === 127) return false;

  // 169.254.0.0/16 (Link-local / Autoconfiguration)
  if (b0 === 169 && b1 === 254) return false;

  // 172.16.0.0/12 (Private network Class B)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return false;

  // 192.168.0.0/16 (Private network Class C)
  if (b0 === 192 && b1 === 168) return false;

  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return false;

  // 240.0.0.0/4 (Reserved / Future use / Loopback)
  if (b0 >= 240) return false;

  return true;
}

/**
 * Expands and parses an IPv6 address string into an array of 8 16-bit integers.
 * Returns null if the format is invalid.
 */
function parseIPv6(ip: string): number[] | null {
  const parts = ip.split("::");
  if (parts.length > 2) return null;

  let left = parts[0] ? parts[0].split(":") : [];
  let right = parts[1] ? parts[1].split(":") : [];

  // If there's an IPv4 address at the end of the IPv6 (e.g. ::ffff:192.168.1.1)
  const lastPart = right.length > 0 ? right[right.length - 1] : left[left.length - 1];
  if (lastPart && net.isIPv4(lastPart)) {
    // Convert IPv4 to two hex blocks: a.b.c.d -> ((a<<8)+b).toString(16) : ((c<<8)+d).toString(16)
    const ipv4Parts = lastPart.split(".").map(Number);
    const block1 = ((ipv4Parts[0] << 8) + ipv4Parts[1]).toString(16);
    const block2 = ((ipv4Parts[2] << 8) + ipv4Parts[3]).toString(16);
    
    if (right.length > 0) {
      right[right.length - 1] = block1;
      right.push(block2);
    } else {
      left[left.length - 1] = block1;
      left.push(block2);
    }
  }

  if (parts.length === 2) {
    const missingCount = 8 - (left.length + right.length);
    const middle = Array(missingCount).fill("0");
    left = [...left, ...middle, ...right];
  }

  if (left.length !== 8) return null;

  try {
    return left.map((hex) => {
      const val = parseInt(hex || "0", 16);
      if (isNaN(val) || val < 0 || val > 0xffff) {
        throw new Error();
      }
      return val;
    });
  } catch {
    return null;
  }
}

/**
 * Validates if an IPv6 address is safe (not loopback, private range, link-local, multicast, or unspecified).
 */
export function isSafeIPv6(ip: string): boolean {
  const blocks = parseIPv6(ip);
  if (!blocks) return false;

  // Unspecified address (::)
  if (blocks.every((b) => b === 0)) return false;

  // Loopback address (::1)
  if (
    blocks[0] === 0 &&
    blocks[1] === 0 &&
    blocks[2] === 0 &&
    blocks[3] === 0 &&
    blocks[4] === 0 &&
    blocks[5] === 0 &&
    blocks[6] === 0 &&
    blocks[7] === 1
  ) {
    return false;
  }

  // fe80::/10 (Link-local unicast)
  if (blocks[0] >= 0xfe80 && blocks[0] <= 0xfebf) return false;

  // fc00::/7 (Unique local address / Private)
  if (blocks[0] >= 0xfc00 && blocks[0] <= 0xfdff) return false;

  // ff00::/8 (Multicast)
  if ((blocks[0] & 0xff00) === 0xff00) return false;

  // IPv4-mapped IPv6 address (::ffff:0:0/96 or ::ffff:a.b.c.d)
  if (
    blocks[0] === 0 &&
    blocks[1] === 0 &&
    blocks[2] === 0 &&
    blocks[3] === 0 &&
    blocks[4] === 0 &&
    blocks[5] === 0xffff
  ) {
    const mappedIpv4 = `${(blocks[6] >> 8) & 0xff}.${blocks[6] & 0xff}.${(blocks[7] >> 8) & 0xff}.${blocks[7] & 0xff}`;
    return isSafeIPv4(mappedIpv4);
  }

  return true;
}

/**
 * Validates if any generic IP address string (IPv4 or IPv6) is safe.
 */
export function isSafeIp(ip: string): boolean {
  const ipType = net.isIP(ip);
  if (ipType === 4) {
    return isSafeIPv4(ip);
  } else if (ipType === 6) {
    return isSafeIPv6(ip);
  }
  return false;
}
