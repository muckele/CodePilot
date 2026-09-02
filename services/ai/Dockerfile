FROM python:3.12.11-alpine3.22 AS build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /service

RUN apk add --no-cache build-base linux-headers
RUN python -m pip install --no-cache-dir uv==0.12.3

COPY pyproject.toml uv.lock ./
COPY app ./app
RUN uv sync --locked --no-dev --no-editable

FROM python:3.12.11-alpine3.22 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/service/.venv/bin:$PATH

WORKDIR /service
RUN apk upgrade --no-cache \
    && apk add --no-cache libstdc++ libgomp
COPY --from=build --chown=65532:65532 /service/.venv /service/.venv
COPY --from=build --chown=65532:65532 /service/app /service/app

USER 65532:65532
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
