<?php
declare(strict_types=1);

date_default_timezone_set('UTC');

function api_send_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function api_require_method(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        api_send_json(204, []);
    }

    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        api_send_json(405, ['error' => 'Method not allowed.']);
    }
}

function api_trim(mixed $value): string
{
    return is_string($value) ? trim($value) : '';
}

function api_normalize_email(mixed $value): string
{
    return strtolower(api_trim($value));
}

function api_valid_email(string $email): bool
{
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

function api_read_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if (strlen($raw) > 1000000) {
        api_send_json(413, ['error' => 'Request body is too large.']);
    }

    if ($raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        api_send_json(400, ['error' => 'Invalid JSON body.']);
    }

    return $decoded;
}

function api_normalize_website(mixed $website): string
{
    $value = api_trim($website);
    if ($value === '') {
        return '';
    }

    if (preg_match('/\s/', $value)) {
        throw new RuntimeException('Company website cannot contain spaces.');
    }

    if (!preg_match('/^[a-z][a-z\d+.-]*:\/\//i', $value)) {
        $value = 'https://' . $value;
    }

    $parts = parse_url($value);
    $scheme = strtolower($parts['scheme'] ?? '');
    if (!in_array($scheme, ['http', 'https'], true)) {
        throw new RuntimeException('Company website must use http or https.');
    }

    if (empty($parts['host'])) {
        throw new RuntimeException('Company website must include a domain.');
    }

    return $value;
}

function api_data_dir(): string
{
    $dir = getenv('ABIT_PORTAL_DATA_DIR') ?: dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'abit_portal_data';
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        api_send_json(500, ['error' => 'Account storage is not writable.']);
    }

    return $dir;
}

function api_store_path(string $name): string
{
    return api_data_dir() . DIRECTORY_SEPARATOR . $name . '.json';
}

function api_with_store(string $name, array $default, callable $callback): mixed
{
    $path = api_store_path($name);
    $handle = fopen($path, 'c+');
    if (!$handle) {
        api_send_json(500, ['error' => 'Account storage could not be opened.']);
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            api_send_json(500, ['error' => 'Account storage could not be locked.']);
        }

        $raw = stream_get_contents($handle) ?: '';
        $store = $raw === '' ? $default : json_decode($raw, true);
        if (!is_array($store)) {
            $store = $default;
        }

        $result = $callback($store);
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);

        return $result;
    } catch (Throwable $error) {
        flock($handle, LOCK_UN);
        fclose($handle);
        throw $error;
    }
}

function api_read_store(string $name, array $default): array
{
    $path = api_store_path($name);
    if (!is_file($path)) {
        return $default;
    }

    $raw = file_get_contents($path) ?: '';
    $store = $raw === '' ? $default : json_decode($raw, true);
    return is_array($store) ? $store : $default;
}

function api_default_user_store(): array
{
    return ['nextUserId' => 1, 'users' => []];
}

function api_default_session_store(): array
{
    return ['sessions' => []];
}

function api_default_ticket_store(): array
{
    return ['nextTicketId' => 1, 'tickets' => []];
}

function api_find_user_by_email(array $store, string $email): ?array
{
    foreach ($store['users'] ?? [] as $user) {
        if (($user['email'] ?? '') === $email) {
            return $user;
        }
    }

    return null;
}

function api_public_user(array $user, string $sessionToken = ''): array
{
    $company = $user['company'] ?? null;
    $public = [
        'id' => $user['id'] ?? null,
        'name' => $user['full_name'] ?? '',
        'email' => $user['email'] ?? '',
        'provider' => $user['provider'] ?? 'Email',
        'company' => is_array($company) && ($company['name'] ?? '') !== '' ? $company : null,
        'createdAt' => $user['created_at'] ?? '',
    ];

    if ($sessionToken !== '') {
        $public['sessionToken'] = $sessionToken;
    }

    return $public;
}

function api_hash_token(string $token): string
{
    return hash('sha256', $token);
}

function api_create_session(int $userId): string
{
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $ttlHours = max(1, min((int) (getenv('SESSION_TTL_HOURS') ?: 168), 720));
    $expiresAt = gmdate('c', time() + ($ttlHours * 3600));
    $now = gmdate('c');

    api_with_store('sessions', api_default_session_store(), function (array &$store) use ($userId, $token, $expiresAt, $now): void {
        $store['sessions'] = array_values(array_filter($store['sessions'] ?? [], function (array $session): bool {
            return strtotime($session['expires_at'] ?? '') > time();
        }));
        $store['sessions'][] = [
            'user_id' => $userId,
            'token_hash' => api_hash_token($token),
            'expires_at' => $expiresAt,
            'created_at' => $now,
        ];
    });

    return $token;
}

function api_bearer_token(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        return trim($matches[1]);
    }

    return '';
}

function api_authenticated_user(): ?array
{
    $token = api_bearer_token();
    if ($token === '') {
        return null;
    }

    $sessions = api_read_store('sessions', api_default_session_store());
    $tokenHash = api_hash_token($token);
    $userId = null;
    foreach ($sessions['sessions'] ?? [] as $session) {
        if (($session['token_hash'] ?? '') === $tokenHash && strtotime($session['expires_at'] ?? '') > time()) {
            $userId = (int) ($session['user_id'] ?? 0);
            break;
        }
    }

    if (!$userId) {
        return null;
    }

    $users = api_read_store('users', api_default_user_store());
    foreach ($users['users'] ?? [] as $user) {
        if ((int) ($user['id'] ?? 0) === $userId) {
            return $user;
        }
    }

    return null;
}

function api_require_user(): array
{
    $user = api_authenticated_user();
    if (!$user) {
        api_send_json(401, ['error' => 'Please sign in to access the support portal.']);
    }

    return $user;
}

function api_registration_payload(array $body): array
{
    $company = isset($body['company']) && is_array($body['company']) ? $body['company'] : [];

    try {
        $website = api_normalize_website($company['website'] ?? $body['companyWebsite'] ?? '');
    } catch (RuntimeException $error) {
        return ['error' => $error->getMessage()];
    }

    return [
        'name' => api_trim($body['name'] ?? ''),
        'email' => api_normalize_email($body['email'] ?? ''),
        'password' => is_string($body['password'] ?? null) ? $body['password'] : '',
        'companyName' => api_trim($company['name'] ?? $body['companyName'] ?? ''),
        'industry' => api_trim($company['industry'] ?? $body['industry'] ?? ''),
        'companySize' => api_trim($company['size'] ?? $body['companySize'] ?? ''),
        'website' => $website,
    ];
}

function api_google_profile(string $accessToken): ?array
{
    if (!function_exists('curl_init')) {
        return null;
    }

    $curl = curl_init('https://www.googleapis.com/oauth2/v3/userinfo');
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
        CURLOPT_TIMEOUT => 15,
    ]);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if ($status < 200 || $status >= 300 || !is_string($body)) {
        return null;
    }

    $profile = json_decode($body, true);
    return is_array($profile) ? $profile : null;
}

function api_register(): void
{
    api_require_method('POST');
    $payload = api_registration_payload(api_read_body());
    if (isset($payload['error'])) {
        api_send_json(422, ['error' => $payload['error']]);
    }

    $errors = [];
    if ($payload['name'] === '') {
        $errors[] = 'Full name is required.';
    }
    if (!api_valid_email($payload['email'])) {
        $errors[] = 'A valid work email is required.';
    }
    if (strlen($payload['password']) < 8) {
        $errors[] = 'Password must be at least 8 characters.';
    }
    if ($payload['companyName'] === '') {
        $errors[] = 'Company name is required.';
    }
    if ($payload['industry'] === '') {
        $errors[] = 'Industry is required.';
    }
    if ($errors) {
        api_send_json(422, ['error' => $errors[0], 'details' => $errors]);
    }

    $createdUser = api_with_store('users', api_default_user_store(), function (array &$store) use ($payload): array {
        if (api_find_user_by_email($store, $payload['email'])) {
            api_send_json(409, ['error' => 'This email is already registered. Please sign in.']);
        }

        $now = gmdate('c');
        $user = [
            'id' => (int) ($store['nextUserId'] ?? 1),
            'full_name' => $payload['name'],
            'email' => $payload['email'],
            'password_hash' => password_hash($payload['password'], PASSWORD_DEFAULT),
            'provider' => 'Email',
            'google_sub' => null,
            'company' => [
                'name' => $payload['companyName'],
                'industry' => $payload['industry'],
                'size' => $payload['companySize'],
                'website' => $payload['website'],
            ],
            'created_at' => $now,
            'updated_at' => $now,
        ];
        $store['nextUserId'] = $user['id'] + 1;
        $store['users'][] = $user;
        return $user;
    });

    $sessionToken = api_create_session((int) $createdUser['id']);
    api_send_json(201, ['user' => api_public_user($createdUser, $sessionToken)]);
}

function api_signin(): void
{
    api_require_method('POST');
    $body = api_read_body();
    $email = api_normalize_email($body['email'] ?? '');
    $password = is_string($body['password'] ?? null) ? $body['password'] : '';
    if (!api_valid_email($email) || $password === '') {
        api_send_json(422, ['error' => 'Email and password are required.']);
    }

    $users = api_read_store('users', api_default_user_store());
    $user = api_find_user_by_email($users, $email);
    if (!$user || !password_verify($password, $user['password_hash'] ?? '')) {
        api_send_json(401, ['error' => 'Invalid credentials. Please try again.']);
    }

    $sessionToken = api_create_session((int) $user['id']);
    api_send_json(200, ['user' => api_public_user($user, $sessionToken)]);
}

function api_social_auth(): void
{
    api_require_method('POST');
    $body = api_read_body();
    $provider = api_trim($body['provider'] ?? '');
    $accessToken = api_trim($body['accessToken'] ?? '');
    if ($provider !== 'Google' || $accessToken === '') {
        api_send_json(422, ['error' => 'A valid Google profile is required.']);
    }

    $profile = api_google_profile($accessToken);
    if (!$profile) {
        api_send_json(401, ['error' => 'Google profile could not be verified.']);
    }

    $name = api_trim($profile['name'] ?? '') ?: api_normalize_email($profile['email'] ?? '');
    $email = api_normalize_email($profile['email'] ?? '');
    $googleSub = api_trim($profile['sub'] ?? '');
    if ($name === '' || !api_valid_email($email) || $googleSub === '') {
        api_send_json(422, ['error' => 'A valid Google profile is required.']);
    }

    $storedUser = api_with_store('users', api_default_user_store(), function (array &$store) use ($name, $email, $provider, $googleSub): array {
        $now = gmdate('c');
        foreach ($store['users'] ?? [] as $index => $user) {
            if (($user['email'] ?? '') === $email) {
                $store['users'][$index]['full_name'] = $name;
                $store['users'][$index]['provider'] = $provider;
                $store['users'][$index]['google_sub'] = $googleSub;
                $store['users'][$index]['updated_at'] = $now;
                return $store['users'][$index];
            }
        }

        $user = [
            'id' => (int) ($store['nextUserId'] ?? 1),
            'full_name' => $name,
            'email' => $email,
            'password_hash' => null,
            'provider' => $provider,
            'google_sub' => $googleSub,
            'company' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ];
        $store['nextUserId'] = $user['id'] + 1;
        $store['users'][] = $user;
        return $user;
    });

    $sessionToken = api_create_session((int) $storedUser['id']);
    api_send_json(200, ['user' => api_public_user($storedUser, $sessionToken)]);
}

function api_priority_label(string $priority): string
{
    return match ($priority) {
        '3' => 'Urgent',
        '2' => 'High',
        '1' => 'Normal',
        default => 'Low',
    };
}

function api_support_overview(): void
{
    api_require_method('GET');
    $user = api_require_user();
    $store = api_read_store('tickets', api_default_ticket_store());
    $email = $user['email'] ?? '';
    $tickets = array_values(array_filter($store['tickets'] ?? [], function (array $ticket) use ($email): bool {
        return ($ticket['requester_email'] ?? '') === $email;
    }));

    $mappedTickets = array_map(function (array $ticket): array {
        return [
            'id' => $ticket['id'] ?? null,
            'title' => $ticket['title'] ?? '',
            'stage' => $ticket['stage'] ?? 'New',
            'state' => $ticket['state'] ?? 'Open',
            'priority' => $ticket['priority_label'] ?? 'Normal',
            'owner' => 'ABiT Team',
            'customer' => $ticket['requester_email'] ?? '',
            'project' => '',
            'updatedAt' => $ticket['updated_at'] ?? $ticket['created_at'] ?? '',
            'createdAt' => $ticket['created_at'] ?? '',
        ];
    }, $tickets);

    api_send_json(200, [
        'summary' => [
            'openTickets' => count($mappedTickets),
            'activeProjects' => 0,
            'activeTasks' => 0,
            'blockedItems' => 0,
            'lastUpdated' => gmdate('c'),
        ],
        'tickets' => $mappedTickets,
        'projects' => [],
        'tasks' => [],
    ]);
}

function api_support_ticket_create(): void
{
    api_require_method('POST');
    $user = api_require_user();
    $body = api_read_body();
    $subject = api_trim($body['subject'] ?? '');
    $message = api_trim($body['message'] ?? '');
    $priority = api_trim($body['priority'] ?? '1') ?: '1';
    if ($subject === '' || $message === '') {
        api_send_json(422, ['error' => 'Ticket subject and details are required.']);
    }

    $ticket = api_with_store('tickets', api_default_ticket_store(), function (array &$store) use ($user, $subject, $message, $priority): array {
        $now = gmdate('c');
        $ticket = [
            'id' => (int) ($store['nextTicketId'] ?? 1),
            'title' => $subject,
            'message' => $message,
            'priority' => $priority,
            'priority_label' => api_priority_label($priority),
            'stage' => 'New',
            'state' => 'Open',
            'requester_name' => $user['full_name'] ?? $user['name'] ?? '',
            'requester_email' => $user['email'] ?? '',
            'created_at' => $now,
            'updated_at' => $now,
        ];
        $store['nextTicketId'] = $ticket['id'] + 1;
        $store['tickets'][] = $ticket;
        return $ticket;
    });

    api_send_json(201, [
        'ticket' => [
            'id' => $ticket['id'],
            'title' => $ticket['title'],
            'stage' => $ticket['stage'],
            'state' => $ticket['state'],
            'priority' => $ticket['priority_label'],
            'owner' => 'ABiT Team',
            'customer' => $ticket['requester_email'],
            'project' => '',
            'updatedAt' => $ticket['updated_at'],
            'createdAt' => $ticket['created_at'],
        ],
    ]);
}

