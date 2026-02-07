using System.Collections.Generic;
using UnityEngine;
using IlluvrseWrestling.Data;

namespace IlluvrseWrestling.Core
{
    public enum GameMode
    {
        QuickMatch,
        Versus,
        Ladder
    }

    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        public GameMode Mode { get; private set; }
        public WrestlerData Player1;
        public WrestlerData Player2;
        public bool Player2IsAI = true;
        public int Player1Rounds;
        public int Player2Rounds;
        public int CurrentLadderIndex;
        public List<WrestlerData> LadderOpponents = new List<WrestlerData>();

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        public void SetMode(GameMode mode)
        {
            Mode = mode;
            Player1Rounds = 0;
            Player2Rounds = 0;
            CurrentLadderIndex = 0;
        }

        public void SetPlayers(WrestlerData player1, WrestlerData player2, bool player2IsAI)
        {
            Player1 = player1;
            Player2 = player2;
            Player2IsAI = player2IsAI;
            Player1Rounds = 0;
            Player2Rounds = 0;
        }

        public void RegisterRoundWin(int playerIndex)
        {
            if (playerIndex == 1)
            {
                Player1Rounds++;
            }
            else
            {
                Player2Rounds++;
            }
        }

        public bool IsMatchOver(int bestOfRounds)
        {
            int winsNeeded = (bestOfRounds / 2) + 1;
            return Player1Rounds >= winsNeeded || Player2Rounds >= winsNeeded;
        }

        public int GetMatchWinner()
        {
            if (Player1Rounds == Player2Rounds)
            {
                return 0;
            }
            return Player1Rounds > Player2Rounds ? 1 : 2;
        }

        public void RegisterMatchResult(int winnerIndex)
        {
            if (Mode != GameMode.Ladder || winnerIndex != 1)
            {
                return;
            }
            CurrentLadderIndex++;
        }
    }
}
