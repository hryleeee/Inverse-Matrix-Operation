import ctypes
import socket
import sys
import threading
import webbrowser

from werkzeug.serving import make_server

from app import app


def find_free_port(preferred=5000):
    for port in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return s.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError('No free port available.')


def main():
    port = find_free_port()
    url = f'http://127.0.0.1:{port}/'
    server = make_server('127.0.0.1', port, app)

    if sys.platform == 'win32':
        ctypes.windll.kernel32.SetConsoleTitleW('Inverse Workbench')

    print('=' * 52)
    print('  INVERSE WORKBENCH  -  exact matrix inverse calculator')
    print('=' * 52)
    print(f'  Running at {url}', flush=True)
    print('  Your browser should open automatically.')
    print('  If it does not, copy the address above into it.')
    print()
    print('  Keep this window open while you use the program.')
    print('  Close this window to quit.')
    print('=' * 52)

    if '--no-browser' not in sys.argv:
        threading.Timer(1.0, webbrowser.open, args=(url,)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
