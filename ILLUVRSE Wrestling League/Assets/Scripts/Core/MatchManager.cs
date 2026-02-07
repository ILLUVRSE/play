using System.Collections;
using UnityEngine;
using IlluvrseWrestling.Data;
using IlluvrseWrestling.Combat;
using IlluvrseWrestling.UI;

namespace IlluvrseWrestling.Core
{
    public class MatchManager : MonoBehaviour
    {
        public WrestlerController Player1;
        public WrestlerController Player2;
        public RingBoundary Ring;
        public MatchHUD HUD;
        public ResultsUI Results;
        public GameSettings Settings;

        float roundTimer;
        bool roundActive;
        bool matchEnded;

        void Start()
        {
            if (Settings == null)
            {
                Settings = Resources.Load<GameSettings>("GameSettings");
            }
            roundTimer = Settings != null ? Settings.RoundTime : 60f;
            StartCoroutine(RoundIntro());
        }

        void Update()
        {
            if (!roundActive || matchEnded)
            {
                return;
            }

            roundTimer -= Time.deltaTime;
            if (HUD != null)
            {
                HUD.SetTimer(roundTimer);
            }

            if (roundTimer <= 0f)
            {
                ResolveTimeOut();
                return;
            }

            if (Player1 == null || Player2 == null)
            {
                return;
            }

            if (Ring != null)
            {
                if (Ring.IsOut(Player1.transform.position))
                {
                    EndRound(2, "Ring Out");
                    return;
                }

                if (Ring.IsOut(Player2.transform.position))
                {
                    EndRound(1, "Ring Out");
                    return;
                }
            }

            CheckKnockdown(Player1, 2);
            CheckKnockdown(Player2, 1);
        }

        void CheckKnockdown(WrestlerController wrestler, int winnerIndex)
        {
            if (wrestler == null || !wrestler.IsKnockedDown)
            {
                return;
            }

            if (HUD != null)
            {
                HUD.ShowKnockdownCount(wrestler.KnockdownTimer, Settings != null ? Settings.KnockdownCountTime : 3f);
            }

            if (wrestler.KnockdownTimer >= (Settings != null ? Settings.KnockdownCountTime : 3f))
            {
                EndRound(winnerIndex, "Knockdown");
            }
        }

        void ResolveTimeOut()
        {
            float p1Stamina = Player1 != null ? Player1.CurrentStamina : 0f;
            float p2Stamina = Player2 != null ? Player2.CurrentStamina : 0f;
            if (p1Stamina == p2Stamina)
            {
                EndRound(0, "Time Out");
                return;
            }

            EndRound(p1Stamina > p2Stamina ? 1 : 2, "Time Out");
        }

        IEnumerator RoundIntro()
        {
            roundActive = false;
            if (HUD != null)
            {
                HUD.ShowRoundIntro();
            }
            yield return new WaitForSeconds(1.5f);
            roundActive = true;
        }

        void EndRound(int winnerIndex, string reason)
        {
            if (matchEnded)
            {
                return;
            }

            roundActive = false;
            GameManager manager = GameManager.Instance;
            if (manager != null && winnerIndex != 0)
            {
                manager.RegisterRoundWin(winnerIndex);
            }

            if (HUD != null)
            {
                HUD.ShowRoundResult(winnerIndex, reason);
            }

            int bestOf = Settings != null ? Settings.BestOfRounds : 3;
            if (manager != null && manager.IsMatchOver(bestOf))
            {
                matchEnded = true;
                int winner = manager.GetMatchWinner();
                manager.RegisterMatchResult(winner);
                if (Results != null)
                {
                    Results.ShowMatchResult(winner);
                }
                return;
            }

            StartCoroutine(ResetRound());
        }

        IEnumerator ResetRound()
        {
            yield return new WaitForSeconds(2f);
            if (Player1 != null)
            {
                Player1.ResetForRound();
            }
            if (Player2 != null)
            {
                Player2.ResetForRound();
            }
            roundTimer = Settings != null ? Settings.RoundTime : 60f;
            if (HUD != null)
            {
                HUD.ResetHUD();
            }
            yield return StartCoroutine(RoundIntro());
        }
    }
}
