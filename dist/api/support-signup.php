<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

api_require_method('POST');

$body = api_read_body();
$companyName = api_trim($body['companyName'] ?? '');
$contactName = api_trim($body['contactName'] ?? '');
$email = api_normalize_email($body['email'] ?? '');
$phone = api_trim($body['phone'] ?? '');
$country = api_trim($body['country'] ?? '');
$existingCustomerCode = api_trim($body['existingCustomerCode'] ?? '');

$servicesInput = $body['services'] ?? [];
if (is_string($servicesInput)) {
    $services = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $servicesInput) ?: [])));
} elseif (is_array($servicesInput)) {
    $services = array_values(array_filter(array_map(
        static fn ($value): string => api_trim($value),
        $servicesInput
    )));
} else {
    $services = [];
}

$errors = [];
if ($companyName === '') {
    $errors[] = 'Company name is required.';
}
if ($contactName === '') {
    $errors[] = 'Contact person is required.';
}
if (!api_valid_email($email)) {
    $errors[] = 'A valid email address is required.';
}
if (strlen($companyName) > 160 || strlen($contactName) > 160 || strlen($email) > 254) {
    $errors[] = 'One or more fields are too long.';
}
if (strlen($phone) > 60 || strlen($country) > 100 || strlen($existingCustomerCode) > 80) {
    $errors[] = 'One or more optional fields are too long.';
}
if (count($services) > 12 || array_filter($services, static fn ($value): bool => strlen($value) > 100)) {
    $errors[] = 'Services selection is invalid.';
}

if ($errors) {
    api_send_json(422, ['error' => implode(' ', $errors)]);
}

$submittedAt = gmdate('c');
$requestId = 'SPR-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
$request = [
    'id' => $requestId,
    'status' => 'pending',
    'company_name' => $companyName,
    'contact_name' => $contactName,
    'email' => $email,
    'phone' => $phone,
    'country' => $country,
    'services' => $services,
    'existing_customer_code' => $existingCustomerCode,
    'submitted_at' => $submittedAt,
];

api_with_store(
    'support-access-requests',
    ['requests' => []],
    static function (array &$store) use ($request): void {
        $requests = is_array($store['requests'] ?? null) ? $store['requests'] : [];
        $requests[] = $request;
        $store['requests'] = array_slice($requests, -1000);
    }
);

$notificationEmail = api_normalize_email(getenv('ABIT_SUPPORT_SIGNUP_EMAIL') ?: 'info@abitcons.com');
if (api_valid_email($notificationEmail)) {
    $subjectCompany = preg_replace('/[^a-zA-Z0-9 ._\-]/', '', $companyName) ?: 'New client';
    $message = implode("\n", [
        'New ABiT support portal access request',
        'Request: ' . $requestId,
        'Company: ' . $companyName,
        'Contact: ' . $contactName,
        'Email: ' . $email,
        'Phone: ' . ($phone ?: '-'),
        'Country: ' . ($country ?: '-'),
        'Services: ' . ($services ? implode(', ', $services) : '-'),
        'Existing customer code: ' . ($existingCustomerCode ?: '-'),
        'Submitted (UTC): ' . $submittedAt,
        '',
        'Provision the approved company/user in ABITask and map it to the ERPNext customer/project before sending credentials.',
    ]);

    @mail(
        $notificationEmail,
        '[ABiT Support Portal] Access request - ' . $subjectCompany,
        $message,
        ['From' => 'noreply@abitcons.com', 'Reply-To' => $email]
    );
}

$portalUrl = rtrim(api_trim(getenv('ABIT_SUPPORT_PORTAL_URL') ?: 'https://support.abitcons.com'), '/') . '/';

api_send_json(201, [
    'request' => [
        'id' => $requestId,
        'status' => 'pending',
        'companyName' => $companyName,
        'submittedAt' => $submittedAt,
    ],
    'portalUrl' => $portalUrl,
    'message' => 'Access request received. ABiT will verify the company and provision the portal user with the correct ERP mapping.',
]);
