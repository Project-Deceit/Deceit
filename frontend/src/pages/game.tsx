import { useEffect, useState } from "react";
import Header from "@/components/header";
import { toast } from "react-toastify";
import { useRouter } from "next/router";
import { gameData } from "@/constants/marketList";

interface Player {
  agentId: number | null;
  mockName: string;
  agentName: string;
  role: string | null;
  playerStatus: string;
  avatar: string | null;
}

interface Event {
  round: number;
  eventType: string;
  agentId: number | null;
  mockName: string | null;
  voteToMockName: string | null;
  text: string | null;
  playerList: Player[];
  currentStatusDescriptions: string[];
  highLightIndex: number | null;
  loadingMockName: string | null;
}

const LoadingIcon = () => (
  <img src="/images/loading.gif" alt="Loading..." className="h-3 w-14" />
);

const GamePage = () => {
  const router = useRouter();
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTexts, setRoundTexts] = useState<{ [key: string]: string }>({});
  const [roundVotes, setRoundVotes] = useState<{ [key: string]: string }>({});
  const [showEndModal, setShowEndModal] = useState(false);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get("roomId");

    if (!roomId) {
      toast.error("Room ID does not exist");
      router.push("/");
      return;
    }

    // 继续原有的数据获取逻辑
    setEvents(gameData.data.roomViewList[0].eventList);
  }, [gameData]);

  useEffect(() => {
    if (events.length === 0) return;

    const timer = setInterval(() => {
      setCurrentEventIndex((prev) => {
        if (prev >= events.length - 1) {
          clearInterval(timer);
          setShowEndModal(true);
          return prev;
        }

        const nextEvent = events[prev + 1];
        const currentEvent = events[prev];

        if (nextEvent.eventType === "agentSpeech" && nextEvent.text) {
          setRoundTexts((prevTexts: any) => ({
            ...prevTexts,
            [`${nextEvent.round}-${nextEvent.mockName}`]: nextEvent.text,
          }));
        } else if (nextEvent.eventType === "vote") {
          setRoundVotes((prevVotes: any) => ({
            ...prevVotes,
            [`${nextEvent.round}-${nextEvent.mockName}`]:
              nextEvent.voteToMockName,
          }));
        }

        if (nextEvent.round !== currentEvent.round) {
          setRoundTexts({});
          setRoundVotes({});
          setCurrentRound(nextEvent.round);
        }

        return prev + 1;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [events]);

  const renderPlayerSection = (player: Player, index: number) => {
    const isHighlighted = currentEvent?.highLightIndex === index;
    const isLoading = currentEvent?.loadingMockName === player.mockName;
    const isEliminated = player.playerStatus !== "alive";
    const roundText = roundTexts[`${currentRound}-${player.mockName}`];
    const roundVote = roundVotes[`${currentRound}-${player.mockName}`];

    return (
      <div className="flex mb-6">
        <div className="flex flex-col items-center mr-4 w-20">
          <img
            src={`/images/agent${index + 1}.jpg`}
            alt={player.agentName}
            className="w-12 h-12 rounded-full mb-2"
          />
          <span className="text-center text-sm font-medium break-words w-full">
            {player.agentName}
          </span>
        </div>

        <div className="flex flex-col">
          <div
            className={`
          text-sm w-[288px] h-[130px] p-[10px] rounded-[12px]
          border border-black shadow-[2px_2px_0_0_#000000]
          ${isEliminated ? "bg-gray-200 text-gray-500" : "bg-white"}
          ${
            isHighlighted && currentEvent?.eventType !== "vote"
              ? "bg-[linear-gradient(226deg,#93FE0D_0%,#D8FF0E_100%)]"
              : ""
          }
          overflow-auto
        `}
          >
            {roundText}
          </div>
          {isLoading && !roundText && (
            <div className="mt-2 mb-2 flex justify-end">
              <LoadingIcon />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSpeakingStatus = () => {
    if (!currentEvent) return null;

    if (currentEvent.eventType === "vote") {
      return currentEvent.playerList.map((player) => {
        if (player.playerStatus !== "alive") return null;

        const playerVote = roundVotes[`${currentRound}-${player.mockName}`];

        if (playerVote) {
          return (
            <div
              key={`vote-${player.mockName}`}
              className="mb-2 text-center text-sm"
            >
              <p className="text-gray-400">
                {`${player.mockName} voted for ${playerVote}`}
              </p>
            </div>
          );
        } else if (currentEvent.loadingMockName === player.mockName) {
          return (
            <div key={player.mockName} className="mb-2 text-center text-sm">
              <p className="text-black-900">
                {`${player.mockName} is voting...`}
              </p>
            </div>
          );
        }
        return null;
      });
    }

    return currentEvent.playerList.map((player) => {
      if (player.playerStatus !== "alive") return null;

      if (roundTexts[`${currentRound}-${player.mockName}`]) {
        return (
          <div key={player.mockName} className="mb-2 text-center text-sm">
            <p className="text-gray-400">{`${player.mockName} finished speaking`}</p>
          </div>
        );
      } else if (currentEvent.loadingMockName === player.mockName) {
        return (
          <div key={player.mockName} className="mb-2 text-center text-sm">
            <p className="text-black-900">{`${player.mockName} is speaking...`}</p>
          </div>
        );
      }
      return null;
    });
  };

  const renderEndGameModal = () => {
    if (!showEndModal || !gameData.data.roomViewList[0].endGameData)
      return null;

    const endGameData = gameData.data.roomViewList[0].endGameData;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-2xl max-w-md w-full flex flex-col items-center">
          <img
            src="/images/game_champion.png"
            alt="game over"
            className="w-80 h-32 mb-4"
          />
          <p className="text-2xl font-medium my-4">
            {endGameData.winnerRole === "spy" ? "Spy" : "Civilian"} Win!
          </p>
          <div className="flex justify-around w-full items-center">
            <div className="flex flex-col w-24">
              <div className="h-4 text-xs text-gray-400 text-center mb-2">
                Spy Word
              </div>
              <div className="h-4 text-base text-red-500 text-center">
                {endGameData.spyWord}
              </div>
            </div>
            <div className="h-3 w-[1px] bg-[#EBEBEB] rounded-[1px]"></div>
            <div className="flex flex-col w-24">
              <div className="h-4 text-xs text-gray-400 text-center mb-2">
                Civilian Word
              </div>
              <div className="h-4 text-base text-black-900 text-center">
                {endGameData.civilianWord}
              </div>
            </div>
          </div>
          <div className="w-full flex flex-col bg-gray-100 rounded-lg p-3 mt-6 relative">
            {endGameData.winnerRole === "spy" && (
              <div
                className="absolute w-[58px] h-[58px] left-[-4px] top-[-4px] bg-cover"
                style={{ backgroundImage: "url(/images/game_win.png)" }}
              ></div>
            )}
            <div className="text-xs text-[#666666] text-center">Spy</div>
            <div className="mt-3 flex justify-around">
              <div className="flex flex-col items-center">
                <div>
                  <div className="ml-7 absolute h-4 w-4 bg-[#d8ff0e] rounded-lg text-[8px] text-black text-center">
                    5.0
                  </div>
                  <div className="w-9 h-9 rounded-full">
                    <img
                      src="/images/agent3.jpg"
                      alt=""
                      className="w-9 h-9 rounded-full"
                    />
                  </div>
                </div>
                <div className="w-20 text-xs text-center">
                  {endGameData.spyAgent.agentName}
                </div>
              </div>
            </div>
          </div>
          <div className="w-full flex flex-col bg-[#fff8f8] rounded-lg p-3 mt-6 relative">
            {endGameData.winnerRole === "civilian" && (
              <div
                className="absolute w-[58px] h-[58px] left-[-4px] top-[-4px] bg-cover"
                style={{ backgroundImage: "url(/images/game_win.png)" }}
              ></div>
            )}
            <div className="text-xs text-[#666666] text-center">Civilian</div>
            <div className="mt-3 flex justify-center">
              {endGameData.civilianAgents.map((agent, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center justify-center"
                >
                  <div className="w-9 h-9 rounded-full">
                    <div className="ml-7 absolute h-4 w-4 bg-[#d8ff0e] rounded-lg text-[8px] text-black text-center">
                      -3.4
                    </div>
                    <img
                      src="/images/agent3.jpg"
                      alt=""
                      className="w-9 h-9 rounded-full"
                    />
                  </div>
                  <div className="w-20 text-xs text-center">
                    {agent.agentName}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowEndModal(false)}
            className="mt-6 h-10 w-full bg-[linear-gradient(226deg,#93FE0D_0%,#FFFF00_100%)] text-black rounded-3xl text-base hover:bg-[linear-gradient(0deg, #fefe01_0%, #DFFE03_100%)]"
          >
            Confirm
          </button>
        </div>
      </div>
    );
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const currentEvent = events[currentEventIndex];

  if (!currentEvent) return null;

  const leftPlayers = currentEvent.playerList.slice(0, 3);
  const rightPlayers = currentEvent.playerList.slice(3, 6);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex items-center mt-20 justify-center">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-8">
            <h2 className="text-xs inline-block px-12 py-2 text-gray-500 shadow-[0_2px_10px_0_rgba(0,0,0,0.05)] rounded-b-[38px]">
              Room ID
              <div className="text-base text-black">
                {new URLSearchParams(window.location.search).get("roomId")}
              </div>
            </h2>
            {/* <p className="text-lg mt-2">Round {currentRound}</p> */}
          </div>

          <div className="flex justify-between gap-8">
            {/* Left side players */}
            <div className="w-[400px]">
              {leftPlayers.map((player, idx) =>
                renderPlayerSection(player, idx)
              )}
            </div>

            {/* Center content */}
            <div className="w-[300px] flex flex-col items-center">
              <div
                className="flex justify-center mt-12 mb-6"
                style={{
                  height: "36px",
                  width: "36px",
                  backgroundImage:
                    "linear-gradient(236deg, #070707 0%, #494949 91%)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src="/images/host_icon.svg"
                  alt="host"
                  className="w-12 h-12"
                />
              </div>
              {
                <div className="p-4 w-full">
                  <p className="text-lg text-center flex items-center justify-center">
                    {currentEvent.eventType === "hostSpeech" ? (
                      <>
                        <img
                          src="/images/host_time.png"
                          alt="host"
                          className="w-7 h-9 mr-2"
                        />
                        <span className="text-black">{currentEvent.text}</span>
                      </>
                    ) : (
                      <>
                        <img
                          src="/images/host_time.png"
                          alt="host"
                          className="w-7 h-9 mr-2"
                        />
                        <span className="mr-2">Round {currentRound}</span>
                      </>
                    )}
                  </p>
                </div>
              }

              <div className="p-6 rounded-lg w-full">
                {/* <h3 className="text-center font-bold mb-4">Status</h3> */}
                {renderSpeakingStatus()}
              </div>
            </div>

            {/* Right side players */}
            <div className="w-[400px]">
              {rightPlayers.map((player, idx) =>
                renderPlayerSection(player, idx + 3)
              )}
            </div>
          </div>
          <div className="w-full flex items-start justify-center mt-4">
            <button
              onClick={() => router.push("/")}
              className="h-8 w-32 rounded-2xl text-xs text-center mr-7 bg-[linear-gradient(226deg,#93FE0D_0%,#FFFF00_100%)]"
            >
              Leave Room
            </button>
            <button
              onClick={copyToClipboard}
              className="h-8 w-32 rounded-2xl text-[#D8FF0E] text-xs text-center bg-black"
            >
              Share Room Link
            </button>
          </div>
        </div>
      </div>

      {renderEndGameModal()}
    </div>
  );
};

export default GamePage;
