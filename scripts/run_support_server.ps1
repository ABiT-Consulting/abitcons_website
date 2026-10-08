$ErrorActionPreference = 'Stop'
Set-Location 'C:\Code\ABiT-Consulting-Global\abitcons_website'
$env:PORT = '8140'
node server\index.js
