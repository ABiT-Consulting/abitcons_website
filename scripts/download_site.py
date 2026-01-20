import html
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import deque
from html.parser import HTMLParser

ROOT_URL = "https://abitcons.com/"
OUT_DIR = "static_site"
USER_AGENT = "Mozilla/5.0 (compatible; static-downloader/1.0)"
TIMEOUT = 30

SKIP_SCHEMES = {"mailto", "tel", "javascript", "data"}

URL_ATTRS = {
    "a": {"href"},
    "img": {"src", "srcset", "data-src", "data-srcset", "data-lazy-src"},
    "script": {"src"},
    "link": {"href"},
    "source": {"src", "srcset"},
    "video": {"src", "poster"},
    "audio": {"src"},
    "iframe": {"src"},
    "embed": {"src"},
    "object": {"data"},
}

CSS_URL_RE = re.compile(r"url\(\s*(?P<quote>['\"]?)(?P<url>[^'\")]+)(?P=quote)\s*\)", re.I)
CSS_IMPORT_RE = re.compile(r"@import\s+(?P<quote>['\"])(?P<url>[^'\"]+)(?P=quote)", re.I)


def normalize_netloc(netloc):
    return netloc.lower().split(":")[0]


BASE_DOMAIN = normalize_netloc(urllib.parse.urlparse(ROOT_URL).netloc)


def is_internal(url):
    parsed = urllib.parse.urlparse(url)
    if not parsed.netloc:
        return True
    netloc = normalize_netloc(parsed.netloc)
    return netloc == BASE_DOMAIN or netloc.endswith("." + BASE_DOMAIN)


def guess_local_path(url):
    parsed = urllib.parse.urlparse(url)
    path = parsed.path or "/"
    if path.endswith("/"):
        path = f"{path}index.html"
    else:
        _, ext = os.path.splitext(path)
        if not ext:
            path = f"{path}/index.html"
    if path.startswith("/"):
        path = path[1:]
    return os.path.join(OUT_DIR, path)


def ensure_parent_dir(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)


def is_html_path(path):
    return os.path.splitext(path)[1].lower() in {".html", ".htm"}


def is_css_path(path):
    return os.path.splitext(path)[1].lower() == ".css"


def decode_body(body, headers):
    content_type = headers.get("Content-Type", "")
    charset = "utf-8"
    if "charset=" in content_type:
        charset = content_type.split("charset=")[-1].split(";")[0].strip()
    try:
        return body.decode(charset, errors="replace")
    except LookupError:
        return body.decode("utf-8", errors="replace")


def rewrite_srcset(value, base_url, from_local_path, schedule_url):
    parts = [p.strip() for p in value.split(",") if p.strip()]
    rewritten = []
    for part in parts:
        tokens = part.split()
        if not tokens:
            continue
        raw_url = tokens[0]
        new_url = rewrite_url(raw_url, base_url, from_local_path, schedule_url)
        rewritten.append(" ".join([new_url] + tokens[1:]))
    return ", ".join(rewritten)


def rewrite_css_text(css_text, base_url, from_local_path, schedule_url):
    def url_repl(match):
        raw_url = match.group("url").strip()
        new_url = rewrite_url(raw_url, base_url, from_local_path, schedule_url)
        quote = match.group("quote") or ""
        return f"url({quote}{new_url}{quote})"

    def import_repl(match):
        raw_url = match.group("url").strip()
        new_url = rewrite_url(raw_url, base_url, from_local_path, schedule_url)
        quote = match.group("quote") or '"'
        return f"@import {quote}{new_url}{quote}"

    css_text = CSS_URL_RE.sub(url_repl, css_text)
    css_text = CSS_IMPORT_RE.sub(import_repl, css_text)
    return css_text


def rewrite_url(raw_url, base_url, from_local_path, schedule_url):
    if not raw_url:
        return raw_url
    if raw_url.startswith("#"):
        return raw_url
    parsed_raw = urllib.parse.urlparse(raw_url)
    if parsed_raw.scheme and parsed_raw.scheme.lower() in SKIP_SCHEMES:
        return raw_url

    if raw_url.startswith("//"):
        abs_url = f"{urllib.parse.urlparse(base_url).scheme}:{raw_url}"
    else:
        abs_url = urllib.parse.urljoin(base_url, raw_url)

    if not is_internal(abs_url):
        return raw_url

    abs_no_frag, _ = urllib.parse.urldefrag(abs_url)
    schedule_url(abs_no_frag)

    target_local = guess_local_path(abs_no_frag)
    rel_path = os.path.relpath(target_local, os.path.dirname(from_local_path))
    rel_url = rel_path.replace(os.sep, "/")

    parsed_abs = urllib.parse.urlparse(abs_url)
    if parsed_abs.query:
        rel_url += "?" + parsed_abs.query
    if parsed_abs.fragment:
        rel_url += "#" + parsed_abs.fragment
    return rel_url


class HTMLRewriter(HTMLParser):
    def __init__(self, base_url, from_local_path, schedule_url):
        super().__init__(convert_charrefs=False)
        self.base_url = base_url
        self.from_local_path = from_local_path
        self.schedule_url = schedule_url
        self.out = []
        self.in_style = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "base":
            for name, value in attrs:
                if name.lower() == "href" and value:
                    rewrite_url(value, self.base_url, self.from_local_path, self.schedule_url)
            return

        new_attrs = []
        for name, value in attrs:
            if value is None:
                new_attrs.append((name, value))
                continue
            attr_name = name.lower()
            tag_name = tag.lower()
            if attr_name == "srcset":
                new_value = rewrite_srcset(value, self.base_url, self.from_local_path, self.schedule_url)
            elif attr_name == "style":
                new_value = rewrite_css_text(value, self.base_url, self.from_local_path, self.schedule_url)
            elif tag_name in URL_ATTRS and attr_name in URL_ATTRS[tag_name]:
                new_value = rewrite_url(value, self.base_url, self.from_local_path, self.schedule_url)
            else:
                new_value = value
            new_attrs.append((name, new_value))
        self.out.append(self._format_start_tag(tag, new_attrs))
        if tag.lower() == "style":
            self.in_style = True

    def handle_startendtag(self, tag, attrs):
        if tag.lower() == "base":
            for name, value in attrs:
                if name.lower() == "href" and value:
                    rewrite_url(value, self.base_url, self.from_local_path, self.schedule_url)
            return

        new_attrs = []
        for name, value in attrs:
            if value is None:
                new_attrs.append((name, value))
                continue
            attr_name = name.lower()
            tag_name = tag.lower()
            if attr_name == "srcset":
                new_value = rewrite_srcset(value, self.base_url, self.from_local_path, self.schedule_url)
            elif attr_name == "style":
                new_value = rewrite_css_text(value, self.base_url, self.from_local_path, self.schedule_url)
            elif tag_name in URL_ATTRS and attr_name in URL_ATTRS[tag_name]:
                new_value = rewrite_url(value, self.base_url, self.from_local_path, self.schedule_url)
            else:
                new_value = value
            new_attrs.append((name, new_value))
        self.out.append(self._format_start_tag(tag, new_attrs, self_closing=True))

    def handle_endtag(self, tag):
        if tag.lower() == "style":
            self.in_style = False
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self.in_style:
            data = rewrite_css_text(data, self.base_url, self.from_local_path, self.schedule_url)
        self.out.append(data)

    def handle_comment(self, data):
        self.out.append(f"<!--{data}-->")

    def handle_decl(self, decl):
        self.out.append(f"<!{decl}>")

    def handle_pi(self, data):
        self.out.append(f"<?{data}>")

    def handle_entityref(self, name):
        self.out.append(f"&{name};")

    def handle_charref(self, name):
        self.out.append(f"&#{name};")

    def _format_start_tag(self, tag, attrs, self_closing=False):
        if attrs:
            rendered = []
            for name, value in attrs:
                if value is None:
                    rendered.append(name)
                else:
                    escaped = html.escape(value, quote=True)
                    rendered.append(f'{name}="{escaped}"')
            attr_text = " " + " ".join(rendered)
        else:
            attr_text = ""
        if self_closing:
            return f"<{tag}{attr_text} />"
        return f"<{tag}{attr_text}>"

    def get_html(self):
        return "".join(self.out)


def main():
    out_dir = OUT_DIR
    os.makedirs(out_dir, exist_ok=True)

    queue = deque()
    scheduled = set()
    downloaded = 0
    failed = []

    def schedule(url):
        if not url:
            return
        if not is_internal(url):
            return
        url, _ = urllib.parse.urldefrag(url)
        if url in scheduled:
            return
        scheduled.add(url)
        queue.append(url)

    schedule(ROOT_URL)

    while queue:
        url = queue.popleft()
        local_path = guess_local_path(url)
        if os.path.exists(local_path):
            try:
                if is_html_path(local_path):
                    with open(local_path, "r", encoding="utf-8", errors="replace") as f:
                        text = f.read()
                    rewriter = HTMLRewriter(url, local_path, schedule)
                    rewriter.feed(text)
                    output = rewriter.get_html()
                    if output != text:
                        with open(local_path, "w", encoding="utf-8", newline="") as f:
                            f.write(output)
                elif is_css_path(local_path):
                    with open(local_path, "r", encoding="utf-8", errors="replace") as f:
                        text = f.read()
                    output = rewrite_css_text(text, url, local_path, schedule)
                    if output != text:
                        with open(local_path, "w", encoding="utf-8", newline="") as f:
                            f.write(output)
                downloaded += 1
            except Exception as exc:
                failed.append((url, f"local parse error: {exc}"))
            continue

        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                final_url = resp.geturl()
                if not is_internal(final_url):
                    continue
                body = resp.read()
                content_type = resp.headers.get("Content-Type", "").lower()
        except Exception as exc:
            failed.append((url, str(exc)))
            continue

        if final_url != url:
            scheduled.add(final_url)

        local_path = guess_local_path(final_url)
        ensure_parent_dir(local_path)

        if "text/html" in content_type or final_url.endswith("/"):
            text = decode_body(body, resp.headers)
            rewriter = HTMLRewriter(final_url, local_path, schedule)
            rewriter.feed(text)
            output = rewriter.get_html()
            with open(local_path, "w", encoding="utf-8", newline="") as f:
                f.write(output)
        elif "text/css" in content_type:
            text = decode_body(body, resp.headers)
            output = rewrite_css_text(text, final_url, local_path, schedule)
            with open(local_path, "w", encoding="utf-8", newline="") as f:
                f.write(output)
        else:
            with open(local_path, "wb") as f:
                f.write(body)

        downloaded += 1
        if downloaded % 50 == 0:
            print(f"Downloaded {downloaded} files...", flush=True)

    print(f"Done. Downloaded {downloaded} files into {out_dir}.")
    if failed:
        print("Failures:")
        for url, err in failed[:20]:
            print(f"- {url}: {err}")
        if len(failed) > 20:
            print(f"... and {len(failed) - 20} more.")


if __name__ == "__main__":
    sys.exit(main())
