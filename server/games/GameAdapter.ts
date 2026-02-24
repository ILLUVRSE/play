export type GameState = Record<string, any>;

export interface GameAdapter {
  slug: string;
  name: string;
  init(opts?: any): GameState;
  onJoin?(state: GameState, ctx: { participantId: string }): GameState;
  onLeave?(state: GameState, ctx: { participantId: string }): GameState;
  applyAction(state: GameState, action: any, ctx: { participantId: string; isHost?: boolean }): GameState;
  evaluate?(state: GameState): any;
  serialize(state: GameState, viewerId?: string): any;
}
