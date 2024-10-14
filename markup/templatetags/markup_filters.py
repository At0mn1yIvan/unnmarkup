from django import template

register = template.Library()


@register.filter
def create_range(value, start_index=0):
    return range(start_index, start_index + value)


@register.filter
def return_item(array, i):
    try:
        return array[i]
    except:
        return None
