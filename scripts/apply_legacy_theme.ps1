$header = @'
<header class="site-header" data-header>
  <div class="container nav">
    <a class="logo" href="/" aria-label="ABiT Consulting">
      <img src="/abitlogo.png" alt="ABiT logo" />
    </a>
    <div class="nav-menu" data-nav-menu>
      <nav class="nav-links" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/about-us/">About Us</a>
        <a href="/web-development-services/">Services</a>
        <a href="/sbo-desk/">Products</a>
        <a href="/blogs/">Blogs</a>
        <a href="/career/">Career</a>
        <a href="/schedule-meeting/">Schedule Meeting</a>
        <a href="/#contact">Contact</a>
      </nav>
      <div class="nav-actions">
        <a class="btn ghost" href="/schedule-meeting/">Schedule Meeting</a>
        <a class="btn primary" href="/#contact">Start a Project</a>
      </div>
    </div>
  </div>
</header>
'@

$footer = @'
<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <a class="logo" href="/">
        <img src="/abitlogo.png" alt="ABiT logo" />
        <span>ABiT Consulting</span>
      </a>
      <p>Transform your business with SAP, Odoo, web, and mobile solutions.</p>
    </div>
    <div>
      <h4>Services</h4>
      <ul>
        <li><a href="/sap-business-one-erp/">SAP Business One ERP</a></li>
        <li><a href="/odoo-erp/">Odoo ERP</a></li>
        <li><a href="/web-development-services/">Web App Development</a></li>
        <li><a href="/iotinternet-of-things/">IoT Solutions</a></li>
      </ul>
    </div>
    <div>
      <h4>Company</h4>
      <ul>
        <li><a href="/about-us/">About Us</a></li>
        <li><a href="/blogs/">Blogs</a></li>
        <li><a href="/career/">Career</a></li>
        <li><a href="/schedule-meeting/">Schedule Meeting</a></li>
      </ul>
    </div>
    <div>
      <h4>Contact</h4>
      <ul>
        <li>Johar Town, Lahore</li>
        <li><a href="tel:+923313133999">+92 331 3133999</a></li>
        <li><a href="/#contact">Contact Form</a></li>
      </ul>
    </div>
    <div>
      <h4>Follow</h4>
      <ul>
        <li>
          <a href="https://www.facebook.com/Abit.consultants" target="_blank" rel="noreferrer"
            >Facebook</a
          >
        </li>
        <li>
          <a
            href="https://www.linkedin.com/in/abit-consulting-2554121a2"
            target="_blank"
            rel="noreferrer"
            >LinkedIn</a
          >
        </li>
      </ul>
    </div>
  </div>
  <p class="footer-bottom">(c) 2024 ABiT Consulting. All rights reserved.</p>
</footer>
'@

$hero = @'
<section class="hero legacy-page-hero">
  <div class="container">
    <div class="panel accent">
      <p class="eyebrow">Schedule Meeting</p>
      <h1>Book a time with ABiT Consulting</h1>
      <p>Use the calendar below to reserve a slot for ERP, cloud, or digital delivery discussions.</p>
    </div>
  </div>
</section>
'@

$cssLink = '<link rel="stylesheet" href="/legacy-theme.css" />'

$files = Get-ChildItem -Path public -Recurse -Filter index.html | Where-Object {
  $content = Get-Content -Raw -LiteralPath $_.FullName
  $content -match 'astra-theme-css-css|elementorFrontendConfig|data-elementor-type="wp-page"'
}

foreach ($file in $files) {
  $content = Get-Content -Raw -LiteralPath $file.FullName
  $changed = $false

  if ($content -notmatch 'legacy-theme\.css') {
    $content = $content.Replace('</head>', $cssLink + "`r`n</head>")
    $changed = $true
  }

  if ($content -notmatch 'class="legacy-theme ') {
    $content = $content -replace '(<body\b[^>]*class=")(.*?)"', '$1legacy-theme $2"'
    $changed = $true
  }

  if ($content -notmatch '<header class="site-header" data-header>') {
    $content = $content.Replace('<div class="hfeed site" id="page">', $header + "`r`n" + '<div class="hfeed site" id="page">')
    $changed = $true
  }

  if ($file.FullName -like '*schedule-meeting\index.html' -and $content -notmatch 'legacy-page-hero') {
    $content = $content.Replace(
      '<div data-elementor-type="wp-page" data-elementor-id="39791" class="elementor elementor-39791">',
      $hero + "`r`n" + '<div data-elementor-type="wp-page" data-elementor-id="39791" class="elementor elementor-39791">'
    )
    $changed = $true
  }

  if ($content -notmatch '<footer class="site-footer">') {
    $content = $content.Replace('</body>', $footer + "`r`n</body>")
    $changed = $true
  }

  if ($changed) {
    [System.IO.File]::WriteAllText($file.FullName, $content, (New-Object System.Text.UTF8Encoding($false)))
  }
}

Write-Host "Updated legacy theme pages:"
$files.FullName | Sort-Object | ForEach-Object { Write-Host $_ }
