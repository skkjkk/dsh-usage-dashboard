import json
import os


def webhook_test(user_input=None):
    password = os.environ.get('WEBHOOK_PASSWORD')
    if not password:
        raise RuntimeError('WEBHOOK_PASSWORD not set')
    if user_input is None:
        user_input = globals().get('user_input')
    if not isinstance(user_input, str):
        raise TypeError('webhook input must be a string')
    try:
        parsed = json.loads(user_input)
    except json.JSONDecodeError as exc:
        raise ValueError('webhook input must be valid JSON') from exc
    if not isinstance(parsed, dict):
        raise TypeError('webhook payload must be a JSON object')
    print('EvoAgent webhook test parsed:', parsed)
    print('EvoAgent webhook test')
