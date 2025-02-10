import { useEffect, useState, useContext } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { getWatchList } from "@/apis/apis";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import { AppContext } from "@/context/AppContext";

interface GameDetail {
  roomId: string;
  name: string;
  blobId: string;
  players: string[];
  winners: string[];
}

const mockData: GameDetail[] = [
  {
    roomId: "1691",
    name: "Game 1",
    blobId: "0x123...456",
    players: ["0xabc...def", "0x789...012"],
    winners: ["0xabc...def"],
  },
  {
    roomId: "1692",
    name: "Game 2",
    blobId: "0x456...789",
    players: ["0xdef...abc", "0x012...789"],
    winners: ["0x012...789"],
  },
];

const WatchList = () => {
  const [gameList, setGameList] = useState<GameDetail[]>([]);
  const { walletAddress, suiName } = useContext(AppContext);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const client = useSuiClient();
  const router = useRouter();

  const fetchGameDetails = async (gameId: string) => {
    try {
      const gameObject = await client.getObject({
        id: gameId,
        options: { showContent: true },
      });

      const gameFields = (gameObject.data?.content as any)?.fields;
      return {
        roomId: gameFields?.room_id || "Unknown",
        name: gameFields?.name || "Unknown",
        blobId: gameFields?.blob_id || "Unknown",
        players: gameFields?.players || [],
        winners: gameFields?.winners || [],
      };
    } catch (error) {
      console.error("Error fetching game details:", error);
      return null;
    }
  };

  useEffect(() => {
    const fetchWatchList = async () => {
      try {
        const stateObject = await client.getObject({
          id: process.env.NEXT_PUBLIC_CONTRACT_STATE_ID!,
          options: { showContent: true },
        });

        const gameRecordsTableId = (stateObject.data?.content as any)?.fields
          ?.game_records?.fields?.id?.id;

        if (gameRecordsTableId) {
          const watchListData = await getWatchList(gameRecordsTableId);
          if (watchListData && watchListData.length > 0) {
            const gameDetails = await Promise.all(
              watchListData.map(async (item) => {
                const details = await fetchGameDetails(item.value);
                return details;
              })
            );

            const validGameDetails = gameDetails.filter(
              (detail): detail is GameDetail => detail !== null
            );
            setGameList(
              validGameDetails.length > 0 ? validGameDetails : mockData
            );
          } else {
            setGameList(mockData);
          }
        } else {
          setGameList(mockData);
        }
      } catch (error) {
        console.error("Error fetching watch list:", error);
        setGameList(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchList();
  }, [client]);

  if (loading) {
    return (
      <div className="flex justify-center items-center mt-6">
        <svg
          className="animate-spin h-8 w-8"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  const totalPages = Math.ceil(gameList.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const currentData = gameList.slice(startIndex, startIndex + pageSize);

  const formatAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleStartWatching = (roomId: string) => {
    if (walletAddress) {
      router.push(`/game?roomId=${roomId}`);
    } else {
      toast.error("Please connect your wallet first");
    }
  };

  const copyToClipboard = async (roomId: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/game?roomId=${roomId}`
      );
      toast.success("Link copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="mt-6">
      <table className="min-w-full bg-white rounded-lg overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-6 py-3 text-left">Room ID</th>
            <th className="px-6 py-3 text-left">Name</th>
            {/* <th className="px-6 py-3 text-left">Blob ID</th> */}
            <th className="px-6 py-3 text-left">Players</th>
            <th className="px-6 py-3 text-left">Winners</th>
            <th className="px-6 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {currentData.map((game) => (
            <tr key={game.roomId} className="border-b">
              <td className="px-6 py-4">{game.roomId}</td>
              <td className="px-6 py-4">{game.name}</td>
              {/* <td className="px-6 py-4">{formatAddress(game.blobId)}</td> */}
              <td className="px-6 py-4">
                {game.players.map(formatAddress).join(", ")}
              </td>
              <td className="px-6 py-4">
                {game.winners.map(formatAddress).join(", ")}
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => handleStartWatching(game.roomId)}
                    className="px-4 py-2 rounded-xl bg-[linear-gradient(226deg,#93FE0D_0%,#FFFF00_100%)] text-black text-sm font-medium"
                  >
                    Start Watching
                  </button>
                  <button
                    onClick={() => copyToClipboard(game.roomId)}
                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-[#333] text-sm hover:bg-gray-50"
                  >
                    Share Room
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border rounded px-2 py-1"
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>
          <div>Total {gameList.length} records</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatchList;
