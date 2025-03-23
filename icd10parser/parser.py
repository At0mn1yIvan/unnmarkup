from bs4 import BeautifulSoup
import requests


def web_scraper(site_url: str, level: int = 1, write_func=None) -> None:
    page = requests.get(site_url).text
    doc = BeautifulSoup(page, "html.parser")
    general_divs = doc.find_all(["div"], class_="h2")
    inner_idx = 1
    for general_div in general_divs:
        inner_div_child = list(general_div.find(["div"], attrs=None).children)[0]

        if inner_div_child.name == 'a':
            write_func(f'{level}-{inner_idx} {inner_div_child.string}')
            next_url = "https://mkb-10.com" + inner_div_child['href']
            web_scraper(next_url, level + 1, write_func)
        elif inner_div_child.name == 'b':
            write_func(f'{level}-{inner_idx} {inner_div_child.string}')

        inner_idx += 1


if __name__ == "__main__":
    url = "https://mkb-10.com/index.php?pid=8001"

    with open("output1.txt", "w", encoding="utf-8") as file:
        def write_to_file(data):
            file.write(data + "\n")

        web_scraper(url, write_func=write_to_file)
