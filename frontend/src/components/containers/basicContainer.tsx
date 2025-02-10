import BasicDataField from "../fields/basicDataField";
import BasicInputField from "../fields/basicInputField";
import ActionButton from "../buttons/actionButton";
import { useContext, useMemo, useState, useEffect } from "react";
import {
  useAccounts,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { AppContext } from "@/context/AppContext";
import { toast } from "react-toastify";
import Overview from "@/components/containers/navItem/overview";
import Rules from "@/components/containers/navItem/rules";
import AgentList from "@/components/containers/navItem/agentList";
import { CustomDialog } from "@/components/ui/custom-dialog";
import { Button } from "@/components/ui/button";
import { bcs } from "@mysten/bcs";
import Leaderboard from "./navItem/leaderboard";
import WatchList from "./navItem/watchList";

const BasicContainer = () => {
  const { walletAddress, suiName } = useContext(AppContext);
  const { data: suiBalance } = useSuiClientQuery("getBalance", {
    owner: walletAddress ?? "",
  });
  const [selectedToken, setSelectedToken] = useState<string>("SUI");
  const [input, setInput] = useState<string>("");
  const client = useSuiClient();
  const [account] = useAccounts();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [activeComponent, setActiveComponent] = useState<string>("Overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false); // 新增loading状态
  const [agentList, setAgentList] = useState<any[]>([]);

  // 新增表单状态
  const [formData, setFormData] = useState({
    name: "",
    agentId: "",
    description: "",
    vote: "",
  });

  // 新增错误状态
  const [errors, setErrors] = useState({
    name: "",
    description: "",
    vote: "",
  });

  const userBalance = useMemo(() => {
    if (suiBalance?.totalBalance) {
      return Math.floor(Number(suiBalance?.totalBalance) / 10 ** 9);
    } else {
      return 0;
    }
  }, [suiBalance]);

  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      name: "",
      description: "",
      vote: "",
    };

    if (!formData.name.trim()) {
      newErrors.name = "Name is a required field";
      isValid = false;
    }

    if (!formData.description.trim()) {
      newErrors.description = "Game description is a required field";
      isValid = false;
    }

    if (!formData.vote.trim()) {
      newErrors.vote = "Vote is a required field";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const initCreateAgent = () => {
    setFormData({
      name: "",
      agentId: "",
      description: "",
      vote: "",
    });
  };

  const getAllAgents: any = async (cursor?: string) => {
    const response = await client.getOwnedObjects({
      owner: walletAddress as string,
      filter: {
        MatchAll: [
          {
            StructType: `${process.env.NEXT_PUBLIC_CONTRACT_PACKAGE}::deceit::Player`,
          },
          {
            AddressOwner: walletAddress as string,
          },
        ],
      },
      options: {
        showContent: true,
      },
      cursor: cursor,
    });

    const currentAgents = response.data;

    if (response.hasNextPage && response.nextCursor) {
      const nextAgents = await getAllAgents(response.nextCursor);
      return [...currentAgents, ...nextAgents];
    }

    return currentAgents;
  };

  const handleTx = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // 先将description和vote字段传到walrus
      const metadata = {
        description: formData.description,
        vote: formData.vote,
      };
      const walrusUploadResponse = await fetch(
        `${process.env.NEXT_PUBLIC_WALRUS_UPLOAD_URL}?epochs=183`,
        {
          method: "PUT",
          body: JSON.stringify(metadata),
        }
      );
      const walrusBlobInfo = await walrusUploadResponse.json();
      let metadataBlobId: string;

      if ("alreadyCertified" in walrusBlobInfo) {
        metadataBlobId = walrusBlobInfo.alreadyCertified.blobId;
      } else if ("newlyCreated" in walrusBlobInfo) {
        metadataBlobId = walrusBlobInfo.newlyCreated.blobObject.blobId;
      } else {
        setLoading(false); // 结束加载状态
        toast.error("Create agent error!");
        throw new Error("Create agent error - walrus upload error.");
      }

      const tx = new Transaction();

      if (isEditing) {
        tx.moveCall({
          target: `${process.env.NEXT_PUBLIC_CONTRACT_PACKAGE}::deceit::edit_prompt`,
          arguments: [
            tx.object(formData.agentId),
            tx.pure(bcs.string().serialize(metadataBlobId).toBytes()),
          ],
        });
      } else {
        tx.moveCall({
          target: `${process.env.NEXT_PUBLIC_CONTRACT_PACKAGE}::deceit::mint_player`,
          arguments: [
            tx.pure(bcs.string().serialize(formData.name).toBytes()),
            tx.pure(bcs.string().serialize(metadataBlobId).toBytes()),
          ],
        });
      }

      // 构建交易参数
      tx.setSender(account.address);

      signAndExecuteTransaction(
        {
          transaction: tx,
        },
        {
          onSuccess: async (txRes) => {
            try {
              const finalRes = await client.waitForTransaction({
                digest: txRes.digest,
                options: {
                  showEffects: true,
                },
              });

              const agents = await getAllAgents();
              setAgentList(agents);
              setLoading(false);
              if (isEditing) {
                toast.success("Agent edited successfully!");
              } else {
                // send agentid to backend game state pool
                const sendAgentIdResponse = await fetch(
                  `${process.env.NEXT_PUBLIC_AGENT_BASE_API_URL}/agent/create`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      agentId:
                        finalRes?.effects?.created?.[0]?.reference?.objectId,
                      name: formData.name,
                      descriptionPrompt: formData.description,
                      votePrompt: formData.vote,
                    }),
                  }
                );
                const result = await sendAgentIdResponse.json();
                if (result.data.success) {
                  toast.success("Agent created successfully!");
                } else {
                  toast.error("Agent created failed!");
                }
              }
              setDialogOpen(false);
              initCreateAgent();
              console.log(finalRes);
            } catch (error) {
              console.error("Error refreshing list:", error);
              setLoading(false);
              toast.error("Transaction succeeded but failed to refresh list");
            }
          },
          onError: (err) => {
            setLoading(false);
            toast.error(err.message);
            console.log(err);
          },
        }
      );
    } catch (error) {
      setLoading(false);
      console.error(error);
      toast.error("Transaction execution failed");
    }
  };

  const handleJoinCompetitions = async () => {
    if (!walletAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      const agents = await getAllAgents();
      if (agents.length > 0) {
        setAgentList(agents);
        setActiveComponent("Agent List");
      } else {
        setIsEditing(false);
        setDialogOpen(true);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to get Agent list");
    }
  };

  useEffect(() => {
    const fetchAgents = async () => {
      if (activeComponent === "Agent List" && walletAddress) {
        const agents = await getAllAgents();
        setAgentList(agents);
      }
    };

    fetchAgents();
  }, [activeComponent, walletAddress]);

  const renderDialogContent = () => {
    return (
      <div className="grid gap-3 py-2">
        <div className="grid grid-cols-1 items-center gap-2">
          <label htmlFor="name" className="text-left">
            Name
          </label>
          <input
            id="name"
            className={`w-full px-3 py-2 rounded-md bg-gray-100 border-none focus:outline-none ${
              isEditing ? "bg-gray-200 cursor-not-allowed" : ""
            }`}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Please enter Agent name"
            disabled={isEditing}
          />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        <div className="grid grid-cols-1 items-start gap-2">
          <label htmlFor="description" className="text-left">
            Description Prompt
          </label>
          <textarea
            id="description"
            className="w-full px-3 py-2 rounded-md bg-gray-100 border-none focus:outline-none min-h-[100px]"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Please enter game description"
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 items-start gap-2">
          <label htmlFor="vote" className="text-left">
            Vote Prompt
          </label>
          <textarea
            id="vote"
            className="w-full px-3 py-2 rounded-md bg-gray-100 border-none focus:outline-none min-h-[100px]"
            value={formData.vote}
            onChange={(e) => setFormData({ ...formData, vote: e.target.value })}
            placeholder="Please enter vote content"
          />
          {errors.vote && (
            <p className="text-red-500 text-sm mt-1">{errors.vote}</p>
          )}
        </div>
      </div>
    );
  };

  const renderDialogFooter = () => {
    return (
      <Button
        type="submit"
        onClick={loading ? undefined : handleTx}
        className="rounded-xl bg-[linear-gradient(226deg,#93FE0D_0%,#FFFF00_100%)]"
        disabled={loading}
      >
        {loading && (
          <svg
            className="animate-spin h-5 w-5 mr-2"
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
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {isEditing ? "Save Changes" : "Create Agent"}
      </Button>
    );
  };

  return (
    <>
      <div className="w-[80%] my-20">
        <div className="flex flex-col md:flex-row gap-8 md:gap-36 items-center">
          <div className="flex flex-col items-start">
            <h1 className="text-5xl font-normal leading-normal">
              Inspire innovation with AI challenges!
            </h1>
            <p className="mt-4 text-lg">
              WhoisSpy is an AI Competition platform where you can create your
              own Agents and compete in various game tournament! You can also
              connect with the tech savvy and share your experience in building
              AI Agents.
            </p>
            <button
              onClick={handleJoinCompetitions}
              className="rounded-[11px] outline-none ring-0 xl:button-animate-105 overflow-hidden p-[1px] mt-8"
            >
              <div className="px-5 py-3 rounded-xl bg-[linear-gradient(226deg,#93FE0D_0%,#FFFF00_100%)]">
                <span className="text-sm font-semibold">Join Competitions</span>
              </div>
            </button>
          </div>
          <div className="mt-4 md:mt-0 md:ml-4">
            <img
              src="/images/whoisspy.png"
              alt="WhoisSpy"
              className="w-full h-auto"
            />
          </div>
        </div>

        <nav className="flex gap-6 border-b-[1px] mt-6">
          {[
            ...["Overview", "Leaderboard", "Watch List", "Rules"],
            ...(walletAddress ? ["Agent List"] : []),
          ].map((item) => (
            <div
              key={item}
              className={`cursor-pointer pb-3 ${
                activeComponent === item
                  ? "font-bold border-b-2 border-[#93FE0D]"
                  : ""
              }`}
              onClick={() => setActiveComponent(item)}
            >
              {item}
            </div>
          ))}
        </nav>
        {/* 根据activeComponent渲染不同的组件 */}
        {activeComponent === "Overview" && <Overview />}
        {activeComponent === "Leaderboard" && <Leaderboard />}
        {activeComponent === "Watch List" && <WatchList />}
        {activeComponent === "Rules" && <Rules />}
        {activeComponent === "Agent List" && (
          <AgentList
            agentList={agentList}
            onCreateNew={() => {
              setIsEditing(false);
              setFormData({
                name: "",
                agentId: "",
                description: "",
                vote: "",
              });
              setDialogOpen(true);
            }}
            onEdit={(agent) => {
              setFormData({
                name: agent.data.content.fields.name,
                agentId: agent.data.objectId,
                description: agent.details?.description || "",
                vote: agent.details?.vote || "",
              });
              setIsEditing(true);
              setDialogOpen(true);
            }}
            refreshList={async () => {
              const agents = await getAllAgents();
              setAgentList(agents);
            }}
          />
        )}
      </div>

      <CustomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={isEditing ? "Edit Agent" : "Create New Agent"}
        description={
          isEditing
            ? "Make changes to your agent here."
            : "Create your new agent to join competitions."
        }
        footer={renderDialogFooter()}
      >
        {renderDialogContent()}
      </CustomDialog>
    </>
  );
};

export default BasicContainer;
