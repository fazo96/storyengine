FROM mcr.microsoft.com/vscode/devcontainers/base

ENV DENO_INSTALL=/deno
RUN mkdir -p /deno \
    && curl -fsSL https://deno.land/x/install/install.sh | sh \
    && chown -R vscode /deno

ENV PATH=${DENO_INSTALL}/bin:${PATH} \
    DENO_DIR=${DENO_INSTALL}/.cache/deno

WORKDIR /workspaces

EXPOSE 8080

RUN apt-get update && \
  apt-get install -y fish

USER vscode
