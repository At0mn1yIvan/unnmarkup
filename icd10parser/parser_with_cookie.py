import json
from http.cookies import SimpleCookie

import requests
from bs4 import BeautifulSoup


def set_session_cookie(url, session) -> None:
    response = session.get(url)
    if "<script>" in response.text:
        cookie_script = response.text
        cookie_value = cookie_script.split('document.cookie="')[1].split('";')[0]

        cookie = SimpleCookie()
        cookie.load(cookie_value)

        for key, morsel in cookie.items():
            session.cookies.set(key, morsel.value)


def web_scraper(site_url: str, session=None) -> dict[str, dict]:
    response = session.get(site_url)
    page = response.text
    doc = BeautifulSoup(page, "html.parser")
    tree = {}
    general_divs = doc.find_all(["div"], class_="h2")

    for general_div in general_divs:
        inner_div_child = list(general_div.find(["div"], attrs=None).children)[
            0
        ]

        if inner_div_child.name == "a":
            next_url = "https://mkb-10.com" + inner_div_child["href"]
            tree[inner_div_child.string] = web_scraper(next_url, session)
        elif inner_div_child.name == "b":
            tree[inner_div_child.string] = None

    return tree


if __name__ == "__main__":
    url = "https://mkb-10.com/index.php?pid=8001"

    session = requests.Session()
    set_session_cookie(url, session)

    with open("diseases.json", "w", encoding="utf-8") as file:
        file.write(
            json.dumps(
                web_scraper(url, session=session), ensure_ascii=False, indent=2
            )
        )
