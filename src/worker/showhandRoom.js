export class ShowhandRoom {
  constructor(state, env) {
    this.state = state
  }

  async fetch(request) {
    return new Response('showhand room', { status: 200 })
  }
}
