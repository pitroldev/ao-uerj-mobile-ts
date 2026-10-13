// oxlint-disable-next-line no-restricted-imports -- a pasta Snackbar é a única porta para a lib
import Toast, { type ToastShowParams } from 'react-native-toast-message';

/**
 * Registro dos `SnackbarHost`. Só o host montado por último (o da folha
 * aberta mais recente, ou o da raiz) desenha: só ele monta o `<Toast>` da
 * lib. Assim a pilha interna da lib, que reordena os hosts a cada
 * renderização, nunca tem mais de um, e o aviso nunca vai para trás da folha.
 */
let hosts: string[] = [];
/** Host cujo `<Toast>` já está montado e registrado na lib. */
let ready: string | null = null;
/** Aviso à espera do próximo host, numa troca de host com o aviso na tela. */
let pending: ToastShowParams | null = null;
const listeners = new Set<() => void>();

export function subscribeHosts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function topHost(): string | null {
  return hosts[hosts.length - 1] ?? null;
}

function emit() {
  listeners.forEach(listener => listener());
}

export function addHost(id: string): void {
  hosts = [...hosts, id];
  emit();
}

export function removeHost(id: string): void {
  hosts = hosts.filter(host => host !== id);
  if (hosts.length === 0) pending = null;
  emit();
}

/** O `<Toast>` do host do topo montou: mostra o aviso que estava esperando. */
export function hostReady(id: string): void {
  ready = id;
  if (pending) {
    const params = pending;
    pending = null;
    Toast.show(params);
  }
}

/** O host deixou de desenhar; o aviso que ele mostrava passa ao próximo. */
export function hostGone(id: string, showing: ToastShowParams | null): void {
  if (ready === id) ready = null;
  if (showing && hosts.length > 0) pending = showing;
}

export function display(params: ToastShowParams): void {
  if (ready) Toast.show(params);
  // trocando de host: o próximo mostra; sem host (testes de tela), não há onde
  else if (hosts.length > 0) pending = params;
}

export function dismiss(): void {
  pending = null;
  if (ready) Toast.hide();
}
