MENU = [
    {"title": "Главная страница", "url_name": "home"},
    {"title": "О сайте", "url_name": "about"},
    {"title": "Разметка", "url_name": "markup:markup_list"},
    {"title": "Загрузка сигналов", "url_name": "markup:signal_upload"},
    {"title": "Валидация", "url_name": "markup:start_validation"},
]


def get_markupheart_context(request):
    return {"mainmenu": MENU}
