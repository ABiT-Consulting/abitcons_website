<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

api_send_json(410, [
    'error' => 'Customer support APIs moved to the dedicated ERP-backed portal.',
    'supportUrl' => 'https://support.abit.ai/',
]);
