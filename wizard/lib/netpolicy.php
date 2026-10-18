<?php
/**
 * Bludit Wizard — network policy.
 *
 * Copyright (C) 2026 Evan Zellner.
 * Licensed under GPL-3.0-only; see LICENSE.
 *
 * Pure, dependency-free helpers for deciding whether a provider URL, hostname
 * or resolved IP address is allowed. Deliberately has NO dependency on Bludit,
 * WordPress-style hooks or the cURL extension, so it can be unit-tested in
 * isolation and reasoned about independently of the transport.
 *
 * Security model
 * --------------
 *  - IP addresses are classified as: invalid | blocked | loopback | private | public.
 *  - "blocked" addresses are never allowed, even when the administrator enables
 *    private-network access (cloud metadata, link-local, multicast, reserved,
 *    documentation, NAT64/6to4/Teredo and other non-routable destinations).
 *  - "private" addresses (RFC1918, CGNAT, IPv6 ULA, single-label intranet names)
 *    are allowed only with an explicit administrator opt-in.
 *  - "loopback" (127.0.0.0/8, ::1, localhost) is always allowed so a local
 *    Ollama keeps working.
 *  - Alternate IPv4 encodings (decimal, octal, hexadecimal, short forms) are
 *    normalised before classification so they cannot dodge the policy.
 *  - IPv4-mapped IPv6 addresses are unwrapped to their IPv4 form.
 *
 * @package BluditWizard
 * @license MIT
 */

if (!class_exists('BluditWizardNetPolicy')) {

    final class BluditWizardNetPolicy
    {
        /** Addresses that must never be reachable, even with private access on. */
        private static $metadataIps = array(
            '169.254.169.254',   // AWS / Azure / GCP / OpenStack IMDS
            '169.254.170.2',     // AWS ECS task metadata
            '169.254.169.123',   // AWS time sync (link-local)
            '100.100.100.200',   // Alibaba Cloud metadata
            '192.0.0.192',       // Oracle Cloud metadata
            'fd00:ec2::254'      // AWS IMDS over IPv6 (ULA)
        );

        private static $metadataHosts = array(
            'metadata',
            'metadata.google.internal',
            'metadata.goog',
            'instance-data',
            'metadata.azure.com',
            'metadata.azure.net'
        );

        /** Always refused (public IPv4). */
        private static $blockedV4 = array(
            '0.0.0.0/8', '169.254.0.0/16', '192.0.0.0/24', '192.0.2.0/24',
            '192.88.99.0/24', '198.18.0.0/15', '198.51.100.0/24',
            '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4', '255.255.255.255/32'
        );

        /** Allowed only with the private-network opt-in. */
        private static $privateV4 = array(
            '10.0.0.0/8', '100.64.0.0/10', '172.16.0.0/12', '192.168.0.0/16'
        );

        /** Loopback (always allowed). */
        private static $loopbackV4 = array('127.0.0.0/8');

        /** Always refused (IPv6). */
        private static $blockedV6 = array(
            '::/128', '::/96', 'fe80::/10', 'ff00::/8', '2001:db8::/32',
            '64:ff9b::/96', '64:ff9b:1::/48', '2002::/16', '2001::/32', '100::/64'
        );

        /** Allowed only with the private-network opt-in (IPv6). */
        private static $privateV6 = array('fc00::/7');

        /** Loopback (always allowed, IPv6). */
        private static $loopbackV6 = array('::1/128');

        // ------------------------------------------------------------------
        // IP handling
        // ------------------------------------------------------------------

        public static function ipVersion($ip)
        {
            if (!is_string($ip) || $ip === '') {
                return 0;
            }
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
                return 4;
            }
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false) {
                return 6;
            }
            return 0;
        }

        public static function isMetadataIp($ip)
        {
            $normalized = self::normalizeIp($ip);
            if ($normalized === null) {
                return false;
            }
            foreach (self::$metadataIps as $candidate) {
                if (strcasecmp($normalized, self::normalizeIp($candidate)) === 0) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Lower-case/normalise an IP literal (also unwraps IPv4-mapped IPv6).
         * Returns null when the input is not a valid IP.
         */
        public static function normalizeIp($ip)
        {
            if (!is_string($ip)) {
                return null;
            }
            $ip = trim($ip);
            if (stripos($ip, '::ffff:') === 0) {
                $v4 = substr($ip, 7);
                if (filter_var($v4, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
                    return $v4;
                }
            }
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
                return $ip;
            }
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false) {
                $packed = @inet_pton($ip);
                return ($packed === false) ? strtolower($ip) : inet_ntop($packed);
            }
            return null;
        }

        public static function hasPrefix($ip, array $cidrs)
        {
            foreach ($cidrs as $cidr) {
                if (self::ipInCidr($ip, $cidr)) {
                    return true;
                }
            }
            return false;
        }

        public static function ipInCidr($ip, $cidr)
        {
            $slash = strpos($cidr, '/');
            if ($slash === false) {
                return false;
            }
            $network = substr($cidr, 0, $slash);
            $bits = (int)substr($cidr, $slash + 1);
            $ipBin = @inet_pton($ip);
            $netBin = @inet_pton($network);
            if ($ipBin === false || $netBin === false || strlen($ipBin) !== strlen($netBin)) {
                return false;
            }
            $fullBytes = intdiv($bits, 8);
            $rem = $bits % 8;
            if ($fullBytes > 0 && substr($ipBin, 0, $fullBytes) !== substr($netBin, 0, $fullBytes)) {
                return false;
            }
            if ($rem > 0) {
                $mask = (0xFF << (8 - $rem)) & 0xFF;
                if ((ord($ipBin[$fullBytes]) & $mask) !== (ord($netBin[$fullBytes]) & $mask)) {
                    return false;
                }
            }
            return true;
        }

        /**
         * Classify an IP literal: invalid | blocked | loopback | private | public.
         */
        public static function classifyIp($ip)
        {
            $norm = self::normalizeIp($ip);
            if ($norm === null) {
                return 'invalid';
            }
            if (self::isMetadataIp($norm)) {
                return 'blocked';
            }
            $version = self::ipVersion($norm);
            if ($version === 4) {
                if (self::hasPrefix($norm, self::$loopbackV4)) {
                    return 'loopback';
                }
                if (self::hasPrefix($norm, self::$blockedV4)) {
                    return 'blocked';
                }
                if (self::hasPrefix($norm, self::$privateV4)) {
                    return 'private';
                }
                return 'public';
            }
            if ($version === 6) {
                if (self::hasPrefix($norm, self::$loopbackV6)) {
                    return 'loopback';
                }
                if (self::hasPrefix($norm, self::$blockedV6)) {
                    return 'blocked';
                }
                if (self::hasPrefix($norm, self::$privateV6)) {
                    return 'private';
                }
                return 'public';
            }
            return 'invalid';
        }

        // ------------------------------------------------------------------
        // Hostname handling
        // ------------------------------------------------------------------

        public static function isMetadataHost($host)
        {
            $host = strtolower(rtrim(trim((string)$host, '[]'), '.'));
            return in_array($host, self::$metadataHosts, true);
        }

        /**
         * Convert alternate IPv4 encodings (decimal, octal, hexadecimal,
         * short forms) to a dotted-quad. Returns null when the host is not a
         * numeric IP-like literal.
         */
        public static function normalizeNumericHost($host)
        {
            $host = trim((string)$host);
            if ($host === '' || !preg_match('/^[0-9a-fA-FxX.]+$/', $host)) {
                return null;
            }
            $parts = explode('.', $host);
            if (count($parts) > 4) {
                return null;
            }
            $nums = array();
            foreach ($parts as $part) {
                if ($part === '') {
                    return null;
                }
                if (preg_match('/^0[xX][0-9a-fA-F]+$/', $part)) {
                    $nums[] = hexdec(substr($part, 2));
                } elseif (preg_match('/^0[0-7]+$/', $part)) {
                    $nums[] = octdec($part);
                } elseif (preg_match('/^[0-9]+$/', $part)) {
                    $nums[] = (int)$part;
                } else {
                    return null;
                }
            }

            $count = count($nums);
            $value = 0;
            if ($count === 1) {
                if ($nums[0] > 0xFFFFFFFF) {
                    return null;
                }
                $value = $nums[0];
            } elseif ($count === 2) {
                if ($nums[0] > 0xFF || $nums[1] > 0xFFFFFF) {
                    return null;
                }
                $value = ($nums[0] << 24) | $nums[1];
            } elseif ($count === 3) {
                if ($nums[0] > 0xFF || $nums[1] > 0xFF || $nums[2] > 0xFFFF) {
                    return null;
                }
                $value = ($nums[0] << 24) | ($nums[1] << 16) | $nums[2];
            } else {
                foreach ($nums as $n) {
                    if ($n > 0xFF) {
                        return null;
                    }
                }
                $value = ($nums[0] << 24) | ($nums[1] << 16) | ($nums[2] << 8) | $nums[3];
            }

            return long2ip($value & 0xFFFFFFFF);
        }

        /**
         * Return the IP literal a host actually represents (an IP literal or a
         * numeric encoding), or null when it is a DNS name.
         */
        public static function hostToIpLiteral($host)
        {
            $host = strtolower(rtrim(trim((string)$host, '[]'), '.'));
            if ($host === '') {
                return null;
            }
            if (self::ipVersion($host) !== 0) {
                return self::normalizeIp($host);
            }
            // Trailing-dot IPv4 (e.g. "127.0.0.1.").
            $trimmed = rtrim($host, '.');
            if ($trimmed !== '' && self::ipVersion($trimmed) !== 0) {
                return self::normalizeIp($trimmed);
            }
            $numeric = self::normalizeNumericHost($host);
            if ($numeric !== null && self::ipVersion($numeric) !== 0) {
                return $numeric;
            }
            return null;
        }

        /**
         * Classify a host string:
         * invalid | blocked | loopback | private | public |
         * loopback-name | private-name | public-name
         */
        public static function classifyHost($host)
        {
            $host = strtolower(rtrim(trim((string)$host, '[]'), '.'));
            if ($host === '') {
                return 'invalid';
            }
            if (self::isMetadataHost($host)) {
                return 'blocked';
            }
            if ($host === 'localhost' || substr($host, -10) === '.localhost') {
                return 'loopback-name';
            }
            $literal = self::hostToIpLiteral($host);
            if ($literal !== null) {
                return self::classifyIp($literal);
            }
            // Unqualified hostnames (no dot) are intra-network/self-hosted.
            if (strpos($host, '.') === false) {
                return 'private-name';
            }
            return 'public-name';
        }

        public static function isLoopbackClass($class)
        {
            return ($class === 'loopback' || $class === 'loopback-name');
        }

        public static function isPrivateClass($class)
        {
            return ($class === 'private' || $class === 'private-name');
        }

        // ------------------------------------------------------------------
        // Policy decisions
        // ------------------------------------------------------------------

        /**
         * Validate a provider base URL. Performs no network I/O.
         * Returns: valid, normalized, https, host, port, class, reason.
         */
        public static function validateProviderUrl($url, $privateAllowed = false)
        {
            $result = array(
                'valid' => false, 'normalized' => '', 'https' => false,
                'host' => '', 'port' => 0, 'class' => '', 'reason' => ''
            );
            $url = trim((string)$url);
            if ($url === '') {
                $result['reason'] = 'Base URL is empty.';
                return $result;
            }
            $parts = parse_url($url);
            if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
                $result['reason'] = 'Base URL must be an absolute http(s) URL.';
                return $result;
            }
            $scheme = strtolower($parts['scheme']);
            if ($scheme !== 'http' && $scheme !== 'https') {
                $result['reason'] = 'Only http and https URLs are allowed.';
                return $result;
            }
            if (isset($parts['user']) || isset($parts['pass'])) {
                $result['reason'] = 'URLs that embed credentials are not allowed.';
                return $result;
            }
            if (isset($parts['query']) || isset($parts['fragment'])) {
                $result['reason'] = 'Base URLs must not contain a query string or fragment.';
                return $result;
            }

            $host = strtolower(rtrim(trim((string)$parts['host'], '[]'), '.'));
            $class = self::classifyHost($host);
            $literal = self::hostToIpLiteral($host);
            $result['host'] = $host;
            $result['class'] = $class;
            $result['https'] = ($scheme === 'https');
            $result['port'] = isset($parts['port']) ? (int)$parts['port'] : 0;

            if ($class === 'invalid') {
                $result['reason'] = 'The provider host is not a valid hostname or IP address.';
                return $result;
            }
            if ($class === 'blocked') {
                $result['reason'] = 'The provider host is a link-local, metadata, reserved or unspecified address and is blocked.';
                return $result;
            }
            if (self::isPrivateClass($class) && !$privateAllowed) {
                $result['reason'] = 'The provider host is on a private or internal network. Enable "Allow private-network provider hosts" for a trusted LAN provider (loopback and localhost are always allowed).';
                return $result;
            }

            $isLocal = self::isLoopbackClass($class) || (self::isPrivateClass($class) && $privateAllowed);
            if ($scheme !== 'https' && !$isLocal) {
                $result['reason'] = 'HTTPS is required for public provider hosts.';
                return $result;
            }

            // Rewrite numeric/ambiguous hosts to their canonical literal so the
            // transport connects to exactly the address that was classified.
            $canonicalHost = ($literal !== null) ? $literal : $host;
            $normalized = $scheme . '://' . self::formatHostForUrl($canonicalHost);
            if ($result['port'] > 0) {
                $normalized .= ':' . $result['port'];
            }
            $path = isset($parts['path']) ? rtrim((string)$parts['path'], '/') : '';
            $normalized .= $path;

            $result['valid'] = true;
            $result['normalized'] = $normalized;
            return $result;
        }

        public static function formatHostForUrl($host)
        {
            if (strpos($host, ':') !== false) {
                return '[' . $host . ']';
            }
            return $host;
        }

        /**
         * Screen a set of resolved addresses. Fail closed: every address must be
         * acceptable.
         * Returns: ok, reason, allowed (list).
         */
        public static function screenIps(array $ips, $privateAllowed = false)
        {
            if (empty($ips)) {
                return array('ok' => false, 'reason' => 'No addresses were resolved for the provider host.', 'allowed' => array());
            }
            $allowed = array();
            foreach ($ips as $ip) {
                $class = self::classifyIp($ip);
                if ($class === 'invalid') {
                    return array('ok' => false, 'reason' => 'The provider host resolved to an invalid address and was refused.', 'allowed' => array());
                }
                if ($class === 'blocked') {
                    return array('ok' => false, 'reason' => 'The provider host resolves to a blocked (link-local, metadata, reserved or unspecified) address and was refused before connecting.', 'allowed' => array());
                }
                if ($class === 'private' && !$privateAllowed) {
                    return array('ok' => false, 'reason' => 'The provider host resolves to a private/internal address (' . self::maskIp($ip) . ') and was refused before connecting. Enable "Allow private-network provider hosts" for a trusted LAN provider.', 'allowed' => array());
                }
                $allowed[] = self::normalizeIp($ip);
            }
            return array('ok' => true, 'reason' => '', 'allowed' => array_values(array_unique($allowed)));
        }

        /**
         * Build CURLOPT_RESOLVE entries, failing closed when pinning is not
         * available or no address survived screening.
         * Returns: ok, reason, entries, ips.
         */
        public static function resolveEntries($host, $port, array $ips, $pinningAvailable, $privateAllowed = false)
        {
            $screened = self::screenIps($ips, $privateAllowed);
            if (!$screened['ok']) {
                return array('ok' => false, 'reason' => $screened['reason'], 'entries' => array(), 'ips' => array());
            }
            if (!$pinningAvailable) {
                return array(
                    'ok' => false,
                    'reason' => 'Secure hostname pinning is not available in this PHP cURL build (CURLOPT_RESOLVE is missing). Refusing to send the request rather than risk an unpinned connection.',
                    'entries' => array(),
                    'ips' => array()
                );
            }
            $entries = array();
            foreach ($screened['allowed'] as $ip) {
                $entries[] = $host . ':' . $port . ':' . self::formatHostForUrl($ip);
            }
            return array('ok' => true, 'reason' => '', 'entries' => $entries, 'ips' => $screened['allowed']);
        }

        public static function maskIp($ip)
        {
            $norm = self::normalizeIp($ip);
            if ($norm === null) {
                return 'hidden';
            }
            if (self::ipVersion($norm) === 4) {
                return preg_replace('/\.\d+$/', '.x', $norm);
            }
            $parts = explode(':', $norm);
            return implode(':', array_slice($parts, 0, 4)) . ':xxxx';
        }

        // ------------------------------------------------------------------
        // Bounded DNS client (no dependency on PHP's blocking resolver)
        // ------------------------------------------------------------------

        /**
         * Resolve a hostname to IPv4 and IPv6 addresses within an explicit
         * wall-clock budget. Returns: ok, ips, error.
         */
        public static function resolveHost($host, array $nameservers, $budget)
        {
            $host = rtrim((string)$host, '.');
            if ($host === '') {
                return array('ok' => false, 'ips' => array(), 'error' => 'The provider host is empty.');
            }
            if (empty($nameservers)) {
                return array('ok' => false, 'ips' => array(), 'error' => 'No DNS resolver is configured (/etc/resolv.conf is missing or has no nameserver).');
            }

            $deadline = microtime(true) + max(0.5, (float)$budget);
            $ips = array();
            foreach (array(1, 28) as $qtype) { // 1 = A, 28 = AAAA
                $remaining = $deadline - microtime(true);
                if ($remaining <= 0) {
                    break;
                }
                foreach (self::dnsQuery($host, $qtype, $nameservers, $remaining) as $ip) {
                    $ips[$ip] = true;
                }
            }

            if (empty($ips)) {
                return array(
                    'ok' => false,
                    'ips' => array(),
                    'error' => 'The provider host could not be resolved within the DNS time budget (possible DNS timeout or misconfiguration).'
                );
            }
            return array('ok' => true, 'ips' => array_keys($ips), 'error' => '');
        }

        /**
         * Send one DNS query over UDP, bounded by $budget seconds across all
         * nameservers. Returns answered IPv4/IPv6 strings.
         */
        public static function dnsQuery($host, $qtype, array $nameservers, $budget)
        {
            $wire = self::dnsEncodeName($host);
            if ($wire === false) {
                return array();
            }
            $id = random_int(0, 65535);
            $query = pack('n', $id) . pack('n', 0x0100) . pack('n', 1)
                . pack('n', 0) . pack('n', 0) . pack('n', 0)
                . $wire . pack('n', $qtype) . pack('n', 1);

            $deadline = microtime(true) + max(0.5, (float)$budget);

            foreach ($nameservers as $server) {
                $remaining = $deadline - microtime(true);
                if ($remaining <= 0) {
                    break;
                }
                $target = (strpos($server, ':') !== false)
                    ? 'udp://[' . $server . ']:53'
                    : 'udp://' . $server . ':53';

                $errno = 0;
                $errstr = '';
                $socket = @stream_socket_client($target, $errno, $errstr, min($remaining, 2.0));
                if (!$socket) {
                    continue;
                }
                @stream_set_blocking($socket, false);
                @fwrite($socket, $query);

                $answer = '';
                while (true) {
                    $left = $deadline - microtime(true);
                    if ($left <= 0) {
                        break;
                    }
                    $read = array($socket);
                    $write = null;
                    $except = null;
                    $sec = (int)floor($left);
                    $usec = (int)(($left - $sec) * 1000000);
                    $ready = @stream_select($read, $write, $except, $sec, $usec);
                    if ($ready === false || $ready === 0) {
                        break; // budget exhausted
                    }
                    $chunk = @fread($socket, 2048);
                    if ($chunk === false || $chunk === '') {
                        break;
                    }
                    $answer .= $chunk;
                    if (strlen($answer) >= 4096) {
                        break;
                    }
                }
                @fclose($socket);

                if ($answer === '') {
                    continue;
                }
                $ips = self::parseDnsAnswers($answer, $id);
                if (!empty($ips)) {
                    return $ips;
                }
            }
            return array();
        }

        public static function dnsEncodeName($host)
        {
            $wire = '';
            foreach (explode('.', (string)$host) as $label) {
                $len = strlen($label);
                if ($len === 0 || $len > 63) {
                    return false;
                }
                $wire .= chr($len) . $label;
            }
            return $wire . "\0";
        }

        /**
         * Parse A and AAAA answers from a DNS response, following name pointers.
         */
        public static function parseDnsAnswers($data, $id)
        {
            if (strlen($data) < 12) {
                return array();
            }
            $header = unpack('nid/nflags/nqd/nan/nns/nar', substr($data, 0, 12));
            if (!is_array($header) || $header['id'] !== $id) {
                return array();
            }

            $offset = 12;
            for ($i = 0; $i < $header['qd']; $i++) {
                $offset = self::dnsSkipName($data, $offset) + 4;
            }

            $ips = array();
            $length = strlen($data);
            for ($i = 0; $i < $header['an']; $i++) {
                $offset = self::dnsSkipName($data, $offset);
                if ($offset + 10 > $length) {
                    break;
                }
                $rr = unpack('ntype/nclass/Nttl/nlen', substr($data, $offset, 10));
                if (!is_array($rr)) {
                    break;
                }
                $rdata = $offset + 10;
                if ($rdata + $rr['len'] > $length) {
                    break;
                }
                if ($rr['class'] === 1 && $rr['len'] === 4 && $rr['type'] === 1) {
                    $ips[] = long2ip(unpack('N', substr($data, $rdata, 4))[1]);
                } elseif ($rr['class'] === 1 && $rr['len'] === 16 && $rr['type'] === 28) {
                    $ip = @inet_ntop(substr($data, $rdata, 16));
                    if ($ip !== false) {
                        $ips[] = $ip;
                    }
                }
                $offset = $rdata + $rr['len'];
            }
            return $ips;
        }

        private static function dnsSkipName($data, $offset)
        {
            $length = strlen($data);
            while ($offset < $length) {
                $byte = ord($data[$offset]);
                if ($byte === 0) {
                    return $offset + 1;
                }
                if (($byte & 0xC0) === 0xC0) {
                    return $offset + 2; // compression pointer
                }
                $offset += 1 + $byte;
            }
            return $length;
        }
    }
}
