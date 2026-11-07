"""Linux production configuration; does not change model preprocessing or outputs."""
import os

bind = '0.0.0.0:' + os.environ.get('PORT', '8080')
# A worker owns its own PyTorch model. Keep one synchronous worker initially.
workers = 1
worker_class = 'sync'
threads = 1
timeout = 120
graceful_timeout = 30
preload_app = False
errorlog = '-'
accesslog = '-'
# Avoid query strings (which can contain credentials) in access logs.
access_log_format = '%(h)s %(m)s %(U)s %(s)s %(L)s'
# Do not trust arbitrary forwarded headers. Verify hosting proxy behavior first.
forwarded_allow_ips = ''


def on_starting(server):
    from deploy.backend.prepare_model import prepare_model
    prepare_model()


def post_worker_init(worker):
    from app import classifier
    if not classifier.available:
        raise RuntimeError('Refusing to serve inference with an unavailable model.')
