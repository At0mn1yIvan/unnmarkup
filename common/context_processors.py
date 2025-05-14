MENU = [
    {"title": "Главная страница", "url_name": "home"},
    {"title": "О сайте", "url_name": "about"},
    {"title": "Разметка", "url_name": "markup:markup"},
    {"title": "Загрузка", "url_name": "markup:signal_upload"},
]


def get_markupheart_context(request):
    return {"mainmenu": MENU}
