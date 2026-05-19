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

function api_find_user_by_odoo_identity(array $store, int $odooUid, string $login, string $email): ?array
{
    foreach ($store['users'] ?? [] as $user) {
        if ((int) ($user['odoo_uid'] ?? 0) === $odooUid) {
            return $user;
        }

        if ($login !== '' && ($user['login'] ?? '') === $login) {
            return $user;
        }

        if ($email !== '' && ($user['email'] ?? '') === $email) {
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
        'login' => $user['login'] ?? $user['email'] ?? '',
        'provider' => ($user['provider'] ?? 'Email') === 'Odoo' ? 'Support' : ($user['provider'] ?? 'Email'),
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

function api_odoo_config(): ?array
{
    $url = rtrim(api_trim(getenv('ODOO_URL') ?: getenv('odooUrl') ?: ''), '/');
    $db = api_trim(getenv('ODOO_DB') ?: getenv('odooDb') ?: '');
    $username = api_trim(getenv('ODOO_USERNAME') ?: getenv('odooUsername') ?: '');
    $password = api_trim(getenv('ODOO_PASSWORD') ?: getenv('odooPassword') ?: '');

    if ($url === '' || $db === '' || $username === '' || $password === '') {
        return null;
    }

    return ['url' => $url, 'db' => $db, 'username' => $username, 'password' => $password];
}

function api_odoo_request(string $path, array $params, string $cookie = ''): array
{
    $config = api_odoo_config();
    if (!$config) {
        throw new RuntimeException('Support portal is not configured.', 503);
    }

    if (!function_exists('curl_init')) {
        throw new RuntimeException('Support portal requires PHP cURL.', 503);
    }

    $curl = curl_init($config['url'] . $path);
    $headers = ['Content-Type: application/json'];
    if ($cookie !== '') {
        $headers[] = 'Cookie: ' . $cookie;
    }

    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode([
            'jsonrpc' => '2.0',
            'method' => 'call',
            'params' => $params,
            'id' => random_int(1, PHP_INT_MAX),
        ], JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => 25,
    ]);

    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $headerSize = (int) curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if (!is_string($raw) || $status < 200 || $status >= 300) {
        throw new RuntimeException($curlError ?: 'Support system request failed.', $status ?: 502);
    }

    $rawHeaders = substr($raw, 0, $headerSize);
    $body = substr($raw, $headerSize);
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Support system returned an invalid response.', 502);
    }

    if (isset($decoded['error'])) {
        $message = $decoded['error']['data']['message'] ?? $decoded['error']['message'] ?? 'Support system request failed.';
        throw new RuntimeException($message, 502);
    }

    $setCookie = '';
    if (preg_match('/^Set-Cookie:\s*([^;\r\n]+)/mi', $rawHeaders, $matches)) {
        $setCookie = $matches[1];
    }

    return ['result' => $decoded['result'] ?? null, 'setCookie' => $setCookie];
}

function api_odoo_service_cookie(): string
{
    static $cookie = null;
    if (is_string($cookie) && $cookie !== '') {
        return $cookie;
    }

    $config = api_odoo_config();
    if (!$config) {
        throw new RuntimeException('Support portal is not configured.', 503);
    }

    $response = api_odoo_request('/web/session/authenticate', [
        'db' => $config['db'],
        'login' => $config['username'],
        'password' => $config['password'],
        'context' => [],
    ]);

    if (empty($response['result']['uid']) || empty($response['setCookie'])) {
        throw new RuntimeException('Support system authentication failed.', 502);
    }

    $cookie = $response['setCookie'];
    return $cookie;
}

function api_odoo_call(string $model, string $method, array $args = [], array $kwargs = []): mixed
{
    $response = api_odoo_request('/web/dataset/call_kw/' . rawurlencode($model) . '/' . rawurlencode($method), [
        'model' => $model,
        'method' => $method,
        'args' => $args,
        'kwargs' => $kwargs,
    ], api_odoo_service_cookie());

    return $response['result'] ?? null;
}

function api_many2one(mixed $value): ?array
{
    if (is_array($value) && count($value) >= 2) {
        return ['id' => $value[0], 'name' => $value[1] ?: ''];
    }

    return null;
}

function api_domain_or(array $conditions): array
{
    $valid = array_values(array_filter($conditions));
    if (count($valid) <= 1) {
        return $valid ? [$valid[0]] : [];
    }

    return array_merge(array_fill(0, count($valid) - 1, '|'), $valid);
}

function api_public_identity(string $login, mixed $email): string
{
    $normalizedEmail = api_normalize_email($email);
    if (api_valid_email($normalizedEmail)) {
        return $normalizedEmail;
    }

    return api_normalize_email($login) ?: api_trim($login) ?: 'support-user';
}

function api_store_odoo_user(array $odooUser, string $requestedLogin): array
{
    $login = api_trim($odooUser['login'] ?? '') ?: api_trim($requestedLogin);
    $email = api_public_identity($login, $odooUser['email'] ?? '');
    $name = api_trim($odooUser['name'] ?? '') ?: $login ?: $email;
    $partner = api_many2one($odooUser['partner_id'] ?? null);
    $company = api_many2one($odooUser['company_id'] ?? null);
    $companyName = $company['name'] ?? $partner['name'] ?? 'Customer';
    $partnerId = (int) ($partner['id'] ?? 0);
    $odooUid = (int) ($odooUser['id'] ?? 0);

    return api_with_store('users', api_default_user_store(), function (array &$store) use ($odooUid, $login, $email, $name, $companyName, $partnerId): array {
        $now = gmdate('c');
        $existing = api_find_user_by_odoo_identity($store, $odooUid, $login, $email);
        foreach ($store['users'] ?? [] as $index => $user) {
            if ($existing && (int) ($user['id'] ?? 0) === (int) ($existing['id'] ?? 0)) {
                $store['users'][$index] = array_merge($user, [
                    'full_name' => $name,
                    'email' => $email,
                    'login' => $login,
                    'password_hash' => null,
                    'provider' => 'Support',
                    'google_sub' => null,
                    'odoo_uid' => $odooUid,
                    'odoo_partner_id' => $partnerId ?: null,
                    'company' => [
                        'name' => $companyName,
                        'industry' => 'Customer',
                        'size' => '',
                        'website' => '',
                    ],
                    'updated_at' => $now,
                ]);
                return $store['users'][$index];
            }
        }

        $user = [
            'id' => (int) ($store['nextUserId'] ?? 1),
            'full_name' => $name,
            'email' => $email,
            'login' => $login,
            'password_hash' => null,
            'provider' => 'Support',
            'google_sub' => null,
            'odoo_uid' => $odooUid,
            'odoo_partner_id' => $partnerId ?: null,
            'company' => [
                'name' => $companyName,
                'industry' => 'Customer',
                'size' => '',
                'website' => '',
            ],
            'created_at' => $now,
            'updated_at' => $now,
        ];
        $store['nextUserId'] = $user['id'] + 1;
        $store['users'][] = $user;
        return $user;
    });
}

function api_odoo_signin(string $login, string $password): array
{
    $config = api_odoo_config();
    if (!$config) {
        throw new RuntimeException('Support portal is not configured.', 503);
    }

    try {
        $response = api_odoo_request('/web/session/authenticate', [
            'db' => $config['db'],
            'login' => $login,
            'password' => $password,
            'context' => [],
        ]);
    } catch (Throwable $error) {
        throw new RuntimeException('Invalid username or password.', 401);
    }

    $uid = (int) ($response['result']['uid'] ?? 0);
    if (!$uid) {
        throw new RuntimeException('Invalid username or password.', 401);
    }

    $users = api_odoo_call('res.users', 'search_read', [[['id', '=', $uid]]], [
        'fields' => ['id', 'name', 'login', 'email', 'partner_id', 'company_id', 'share', 'active'],
        'limit' => 1,
    ]);
    $odooUser = is_array($users) ? ($users[0] ?? null) : null;
    if (!$odooUser || empty($odooUser['active'])) {
        throw new RuntimeException('This user is inactive. Contact ABiT support.', 403);
    }

    return api_store_odoo_user($odooUser, $login);
}

function api_support_recovery_message(): string
{
    return 'If this account is registered, recovery instructions were sent to the registered contact.';
}

function api_find_support_recovery_user(string $login): ?array
{
    $requestedLogin = api_trim($login);
    $email = api_normalize_email($requestedLogin);
    $domain = api_domain_or([
        $requestedLogin !== '' ? ['login', '=', $requestedLogin] : null,
        api_valid_email($email) ? ['email', '=', $email] : null,
    ]);

    if (!$domain) {
        return null;
    }

    $users = api_odoo_call('res.users', 'search_read', [$domain], [
        'fields' => ['id', 'name', 'login', 'email', 'partner_id', 'active'],
        'limit' => 1,
    ]);

    return is_array($users) ? ($users[0] ?? null) : null;
}

function api_recovery_contact(array $user): array
{
    $partner = api_many2one($user['partner_id'] ?? null);
    $contact = [
        'email' => api_trim($user['email'] ?? ''),
        'phone' => '',
    ];

    if (!$partner || empty($partner['id'])) {
        return $contact;
    }

    $partners = api_odoo_call('res.partner', 'search_read', [[['id', '=', (int) $partner['id']]]], [
        'fields' => ['email', 'mobile', 'phone'],
        'limit' => 1,
    ]);
    $partnerRecord = is_array($partners) ? ($partners[0] ?? null) : null;
    if (is_array($partnerRecord)) {
        $contact['email'] = $contact['email'] ?: api_trim($partnerRecord['email'] ?? '');
        $contact['phone'] = api_trim($partnerRecord['mobile'] ?? '') ?: api_trim($partnerRecord['phone'] ?? '');
    }

    return $contact;
}

function api_normalize_whatsapp_number(string $phone): string
{
    $normalized = preg_replace('/[^\d+]/', '', api_trim($phone)) ?? '';
    if ($normalized === '') {
        return '';
    }
    return str_starts_with($normalized, '00') ? '+' . substr($normalized, 2) : $normalized;
}

function api_recovery_notification_text(string $name): string
{
    $suffix = $name !== '' ? ' (' . $name . ')' : '';
    return 'Password recovery was requested for your ABiT support account' . $suffix . '. For your security, use the recovery email or contact ABiT support if you did not request this.';
}

function api_send_twilio_whatsapp(string $phone, string $message): bool
{
    $sid = api_trim(getenv('TWILIO_ACCOUNT_SID') ?: '');
    $token = api_trim(getenv('TWILIO_AUTH_TOKEN') ?: '');
    $from = api_trim(getenv('TWILIO_WHATSAPP_FROM') ?: '');
    if ($sid === '' || $token === '' || $from === '' || !function_exists('curl_init')) {
        return false;
    }

    $to = str_starts_with($phone, 'whatsapp:') ? $phone : 'whatsapp:' . $phone;
    $curl = curl_init('https://api.twilio.com/2010-04-01/Accounts/' . rawurlencode($sid) . '/Messages.json');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Basic ' . base64_encode($sid . ':' . $token),
            'Content-Type: application/x-www-form-urlencoded',
        ],
        CURLOPT_POSTFIELDS => http_build_query([
            'From' => $from,
            'To' => $to,
            'Body' => $message,
        ]),
        CURLOPT_TIMEOUT => 20,
    ]);
    curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('WhatsApp recovery notification failed.', 502);
    }

    return true;
}

function api_send_meta_whatsapp(string $phone, string $message): bool
{
    $token = api_trim(getenv('META_WA_TOKEN') ?: '');
    $phoneNumberId = api_trim(getenv('META_WA_PHONE_NUMBER_ID') ?: '');
    if ($token === '' || $phoneNumberId === '' || !function_exists('curl_init')) {
        return false;
    }

    $to = ltrim(api_normalize_whatsapp_number($phone), '+');
    if ($to === '') {
        return false;
    }

    $curl = curl_init('https://graph.facebook.com/v19.0/' . rawurlencode($phoneNumberId) . '/messages');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'messaging_product' => 'whatsapp',
            'to' => $to,
            'type' => 'text',
            'text' => ['body' => $message],
        ], JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => 20,
    ]);
    curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('WhatsApp recovery notification failed.', 502);
    }

    return true;
}

function api_send_whatsapp_recovery_notification(string $phone, string $message): bool
{
    $normalizedPhone = api_normalize_whatsapp_number($phone);
    if ($normalizedPhone === '') {
        return false;
    }

    $provider = strtolower(api_trim(getenv('WHATSAPP_PROVIDER') ?: ''));
    if ($provider === 'twilio') {
        return api_send_twilio_whatsapp($normalizedPhone, $message);
    }
    if ($provider === 'meta') {
        return api_send_meta_whatsapp($normalizedPhone, $message);
    }

    return api_send_meta_whatsapp($normalizedPhone, $message) || api_send_twilio_whatsapp($normalizedPhone, $message);
}

function api_request_support_password_recovery(string $login): void
{
    if (!api_odoo_config()) {
        return;
    }

    $user = api_find_support_recovery_user($login);
    if (!$user || empty($user['id']) || empty($user['active'])) {
        return;
    }

    $contact = api_recovery_contact($user);
    $errors = [];
    $attempted = false;
    $delivered = false;

    if (($contact['email'] ?? '') !== '' || api_valid_email(api_normalize_email($user['login'] ?? ''))) {
        $attempted = true;
        try {
            api_odoo_call('res.users', 'action_reset_password', [[(int) $user['id']]]);
            $delivered = true;
        } catch (Throwable $error) {
            $errors[] = $error;
        }
    }

    if (($contact['phone'] ?? '') !== '') {
        $attempted = true;
        try {
            api_send_whatsapp_recovery_notification($contact['phone'], api_recovery_notification_text(api_trim($user['name'] ?? '')));
            $delivered = true;
        } catch (Throwable $error) {
            $errors[] = $error;
        }
    }

    if ($attempted && !$delivered && count($errors) > 0) {
        throw $errors[0];
    }
}

function api_support_forgot_password(): void
{
    api_require_method('POST');
    $body = api_read_body();
    $login = api_trim($body['login'] ?? $body['username'] ?? $body['email'] ?? '');

    if ($login === '') {
        api_send_json(422, ['error' => 'Enter your username or registered email first.']);
    }

    try {
        api_request_support_password_recovery($login);
    } catch (Throwable $error) {
        error_log('Support password recovery request could not be completed: ' . $error->getMessage());
    }

    api_send_json(200, ['message' => api_support_recovery_message()]);
}

function api_register(): void
{
    api_require_method('POST');
    api_send_json(410, ['error' => 'Customer accounts are provisioned by ABiT. Please use your assigned support login.']);

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
    $login = api_trim($body['login'] ?? $body['username'] ?? $body['email'] ?? '');
    $password = is_string($body['password'] ?? null) ? $body['password'] : '';
    if ($login === '' || $password === '') {
        api_send_json(422, ['error' => 'Username and password are required.']);
    }

    if (api_odoo_config()) {
        try {
            $user = api_odoo_signin($login, $password);
            $sessionToken = api_create_session((int) $user['id']);
            api_send_json(200, ['user' => api_public_user($user, $sessionToken)]);
        } catch (Throwable $error) {
            $status = (int) $error->getCode();
            api_send_json($status >= 400 && $status < 600 ? $status : 401, [
                'error' => $error->getMessage() ?: 'Invalid username or password.',
            ]);
        }
    }

    $email = api_normalize_email($login);
    if (!api_valid_email($email)) {
        api_send_json(422, ['error' => 'A valid email address is required in local account mode.']);
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
    api_send_json(410, ['error' => 'Customer support access uses ABiT-issued credentials only.']);

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

function api_state_label(mixed $state): string
{
    return match ((string) ($state ?: 'normal')) {
        'blocked' => 'Blocked',
        'done' => 'Ready',
        default => 'In progress',
    };
}

function api_sanitize_portal_text(mixed $value): string
{
    $text = (string) ($value ?? '');
    $text = preg_replace('/odoo\s*bot/i', 'ABiT Team', $text) ?? $text;
    return preg_replace('/\bodoo\b/i', 'ERP', $text) ?? $text;
}

function api_customer_odoo_context(array $user): array
{
    $email = api_valid_email(api_normalize_email($user['email'] ?? '')) ? api_normalize_email($user['email'] ?? '') : '';
    $company = is_array($user['company'] ?? null) ? api_trim($user['company']['name'] ?? '') : '';
    $partnerId = (int) ($user['odoo_partner_id'] ?? 0);
    $allowCompanyMatch = strtolower(api_trim(getenv('ODOO_MATCH_COMPANY_NAME') ?: '')) === 'true';
    $domain = api_domain_or([
        $partnerId > 0 ? ['id', '=', $partnerId] : null,
        $email !== '' ? ['email', '=', $email] : null,
        $allowCompanyMatch && $company !== '' ? ['name', '=', $company] : null,
    ]);

    $partners = $domain ? api_odoo_call('res.partner', 'search_read', [$domain], [
        'fields' => ['id', 'name', 'email', 'parent_id', 'commercial_partner_id'],
        'limit' => 25,
    ]) : [];
    $partners = is_array($partners) ? $partners : [];

    $ids = [];
    foreach ($partners as $partner) {
        if (!empty($partner['id'])) {
            $ids[(int) $partner['id']] = true;
        }
        foreach (['parent_id', 'commercial_partner_id'] as $field) {
            $related = api_many2one($partner[$field] ?? null);
            if (!empty($related['id'])) {
                $ids[(int) $related['id']] = true;
            }
        }
    }

    return [
        'email' => $email,
        'login' => api_trim($user['login'] ?? $user['email'] ?? ''),
        'partners' => $partners,
        'partnerIds' => array_keys($ids),
    ];
}

function api_map_odoo_ticket(array $ticket): array
{
    $stage = api_many2one($ticket['stage_id'] ?? null);
    $owner = api_many2one($ticket['user_id'] ?? null);
    $project = api_many2one($ticket['project_id'] ?? null);
    $partner = api_many2one($ticket['partner_id'] ?? null);

    return [
        'id' => $ticket['id'] ?? null,
        'title' => api_sanitize_portal_text($ticket['name'] ?? ''),
        'stage' => api_sanitize_portal_text($stage['name'] ?? 'New'),
        'state' => api_state_label($ticket['kanban_state'] ?? ''),
        'priority' => api_priority_label((string) ($ticket['priority'] ?? '1')),
        'owner' => api_sanitize_portal_text($owner['name'] ?? 'Unassigned'),
        'customer' => api_sanitize_portal_text($partner['name'] ?? $ticket['partner_email'] ?? ''),
        'project' => api_sanitize_portal_text($project['name'] ?? ''),
        'updatedAt' => $ticket['write_date'] ?? '',
        'createdAt' => $ticket['create_date'] ?? '',
    ];
}

function api_odoo_support_overview(array $user): void
{
    $context = api_customer_odoo_context($user);
    $ticketDomain = api_domain_or([
        $context['partnerIds'] ? ['partner_id', 'in', $context['partnerIds']] : null,
        $context['email'] !== '' ? ['partner_email', '=', $context['email']] : null,
    ]);

    $tickets = $ticketDomain ? api_odoo_call('helpdesk.ticket', 'search_read', [$ticketDomain], [
        'fields' => [
            'id',
            'name',
            'stage_id',
            'kanban_state',
            'priority',
            'user_id',
            'partner_id',
            'partner_email',
            'project_id',
            'write_date',
            'create_date',
        ],
        'order' => 'write_date desc',
        'limit' => 40,
    ]) : [];
    $tickets = is_array($tickets) ? array_map('api_map_odoo_ticket', $tickets) : [];

    api_send_json(200, [
        'summary' => [
            'openTickets' => count(array_filter($tickets, fn (array $ticket): bool => !preg_match('/done|closed|ready/i', $ticket['stage'] ?? ''))),
            'activeProjects' => 0,
            'activeTasks' => 0,
            'blockedItems' => count(array_filter($tickets, fn (array $ticket): bool => ($ticket['state'] ?? '') === 'Blocked')),
            'lastUpdated' => gmdate('c'),
        ],
        'tickets' => $tickets,
        'projects' => [],
        'tasks' => [],
    ]);
}

function api_odoo_support_ticket_create(array $user, string $subject, string $message, string $priority): void
{
    $context = api_customer_odoo_context($user);
    $values = [
        'name' => $subject,
        'description' => '<p>' . str_replace("\n", '<br>', htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')) . '</p><p><strong>Submitted by:</strong> ' . htmlspecialchars($user['full_name'] ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . ' (' . htmlspecialchars($context['email'] ?: $context['login'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . ')</p>',
        'priority' => in_array($priority, ['0', '1', '2', '3'], true) ? $priority : '1',
        'kanban_state' => 'normal',
    ];

    if ($context['email'] !== '') {
        $values['partner_email'] = $context['email'];
    }

    if (!empty($context['partnerIds'][0])) {
        $values['partner_id'] = (int) $context['partnerIds'][0];
    }

    $teamId = (int) (getenv('ODOO_HELPDESK_TEAM_ID') ?: getenv('ODOO_TEAM_ID') ?: 0);
    if ($teamId > 0) {
        $values['team_id'] = $teamId;
    }

    $ticketId = api_odoo_call('helpdesk.ticket', 'create', [$values]);
    $tickets = api_odoo_call('helpdesk.ticket', 'search_read', [[['id', '=', $ticketId]]], [
        'fields' => [
            'id',
            'name',
            'stage_id',
            'kanban_state',
            'priority',
            'user_id',
            'partner_id',
            'partner_email',
            'project_id',
            'write_date',
            'create_date',
        ],
        'limit' => 1,
    ]);

    $ticket = is_array($tickets) && isset($tickets[0]) ? api_map_odoo_ticket($tickets[0]) : [
        'id' => $ticketId,
        'title' => $subject,
        'stage' => 'New',
        'state' => 'In progress',
        'priority' => api_priority_label($priority),
        'owner' => 'ABiT Team',
        'customer' => $context['email'],
        'project' => '',
        'updatedAt' => gmdate('c'),
        'createdAt' => gmdate('c'),
    ];

    api_send_json(201, ['ticket' => $ticket]);
}

function api_support_overview(): void
{
    api_require_method('GET');
    $user = api_require_user();
    if (api_odoo_config()) {
        api_odoo_support_overview($user);
    }

    $store = api_read_store('tickets', api_default_ticket_store());
    $email = $user['email'] ?? '';
    $tickets = array_values(array_filter($store['tickets'] ?? [], function (array $ticket) use ($email): bool {
        return ($ticket['requester_email'] ?? '') === $email;
    }));

    $mappedTickets = array_map(function (array $ticket): array {
        return [
            'id' => $ticket['id'] ?? null,
            'title' => api_sanitize_portal_text($ticket['title'] ?? ''),
            'stage' => api_sanitize_portal_text($ticket['stage'] ?? 'New'),
            'state' => api_sanitize_portal_text($ticket['state'] ?? 'Open'),
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

    if (api_odoo_config()) {
        api_odoo_support_ticket_create($user, $subject, $message, $priority);
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
            'title' => api_sanitize_portal_text($ticket['title']),
            'stage' => api_sanitize_portal_text($ticket['stage']),
            'state' => api_sanitize_portal_text($ticket['state']),
            'priority' => $ticket['priority_label'],
            'owner' => 'ABiT Team',
            'customer' => $ticket['requester_email'],
            'project' => '',
            'updatedAt' => $ticket['updated_at'],
            'createdAt' => $ticket['created_at'],
        ],
    ]);
}

