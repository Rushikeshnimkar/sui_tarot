"use client";
import {generateNonce, generateRandomness} from '@mysten/zklogin';
import {useSui} from "./hooks/useSui";
import {useLayoutEffect} from "react";
import {fromB64} from "@mysten/bcs";
import {Ed25519Keypair} from '@mysten/sui.js/keypairs/ed25519';
import {Keypair, PublicKey} from "@mysten/sui.js/cryptography";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import Cookies from "js-cookie";
import axios from "axios";
import dynamic from 'next/dynamic';
import { ConnectButton, useCurrentWallet} from '@mysten/dapp-kit';
import {TransactionBlock} from "@mysten/sui.js/transactions";
import '@mysten/dapp-kit/dist/index.css';
import {GetSaltRequest, LoginResponse, UserKeyData, ZKPPayload, ZKPRequest} from "./types/UsefulTypes";
import  jwtDecode  from "jwt-decode";
import {genAddressSeed, getZkLoginSignature, jwtToAddress} from '@mysten/zklogin';
import {toast} from "react-hot-toast";


export default function Home() {
  const [drawnCard, setDrawnCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ques, setques] = useState(false);
  const [description, setDescription] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [cardimage, setcardimage] = useState("");
  const [position, setposition] = useState("");
  const [mintdone, setmintdone] = useState(false);
  const { currentWallet, connectionStatus } = useCurrentWallet()
  const [subjectID, setSubjectID] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transactionInProgress, setTransactionInProgress] = useState<boolean>(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [userSalt, setUserSalt] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [jwtEncoded, setJwtEncoded] = useState<string | null>(null);



  const MINIMUM_BALANCE = 0.003;  
//   const getStoredWallet = () => {
//     try {
//       return window.localStorage.getItem("connectedWallet");
//     } catch {
//       return null;
//     }
//   };
  
//   const [connectedWallet, setConnectedWallet] = useState(getStoredWallet());
  
//  useEffect(() => {
//     if (connectionStatus === "connected" && currentWallet.accounts.length > 0) {
//       const address = currentWallet.accounts[0].address;
//       setConnectedWallet(address);
//     } else {
//       setConnectedWallet(null);
//     }
//   }, [connectionStatus, currentWallet]);


  // console.log("sui wallet", currentWallet);

// -------------------------------------------------------------------------------------------------------------------------------
const {suiClient} = useSui();

  const [loginUrl, setLoginUrl] = useState<string | null>();

    async function prepareLogin() {
        const {epoch, epochDurationMs, epochStartTimestampMs} = await suiClient.getLatestSuiSystemState();


        const maxEpoch = parseInt(epoch) + 2; // this means the ephemeral key will be active for 2 epochs from now.
        const ephemeralKeyPair : Keypair = new Ed25519Keypair();
        const ephemeralPrivateKeyB64 = ephemeralKeyPair.export().privateKey;


        const ephemeralPublicKey : PublicKey = ephemeralKeyPair.getPublicKey()
        const ephemeralPublicKeyB64 = ephemeralPublicKey.toBase64();

        const jwt_randomness = generateRandomness();
        const nonce = generateNonce(ephemeralPublicKey, maxEpoch, jwt_randomness);
        

        console.log("current epoch = " + epoch);
        console.log("maxEpoch = " + maxEpoch);
        console.log("jwt_randomness = " + jwt_randomness);
        console.log("ephemeral public key = " + ephemeralPublicKeyB64);
        console.log("nonce = " + nonce);

        const userKeyData: UserKeyData = {
            randomness: jwt_randomness.toString(),
            nonce: nonce,
            ephemeralPublicKey: ephemeralPublicKeyB64,
            ephemeralPrivateKey: ephemeralPrivateKeyB64,
            maxEpoch: maxEpoch
        }
        localStorage.setItem("userKeyData", JSON.stringify(userKeyData));
        return userKeyData
    }






    function getRedirectUri() {
        const protocol = window.location.protocol;
        const host = window.location.host;
        const customRedirectUri = protocol + "//" + host+ "/" ;
        console.log("customRedirectUri = " + customRedirectUri);
        return customRedirectUri;
    }
    useLayoutEffect(() => {

      prepareLogin().then((userKeyData) => {

          const REDIRECT_URI = 'https://zklogin-dev-redirect.vercel.app/api/auth';
          const customRedirectUri = getRedirectUri();
          const params = new URLSearchParams({
              // When using the provided test client ID + redirect site, the redirect_uri needs to be provided in the state.
              state: new URLSearchParams({
                  redirect_uri: customRedirectUri
              }).toString(),
              // Test Client ID for devnet / testnet:
              client_id: '595966210064-3nnnqvmaelqnqsmq448kv05po362smt2.apps.googleusercontent.com',
              redirect_uri: REDIRECT_URI,
              response_type: 'id_token',
              scope: 'openid',
              nonce: userKeyData.nonce,
          });

          setLoginUrl(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
      });


  }, []);



  async function getSalt(subject: string, jwtEncoded: string) {
    const getSaltRequest: GetSaltRequest = {
        subject: subject,
        jwt: jwtEncoded!
    }
    console.log("Getting salt...");
    console.log("Subject = ", subject);
    console.log("jwt = ", jwtEncoded);
    const response = await axios.post('/api/userinfo/get/salt', getSaltRequest);
    console.log("getSalt response = ", response);
    if (response?.data.status == 200) {
        const userSalt = response.data.salt;
        console.log("Salt fetched! Salt = ", userSalt);
        return userSalt;
    } else {
        console.log("Error Getting SALT");
        return null;
    }
}





async function checkIfAddressHasBalance(address: string): Promise<boolean> {
  console.log("Checking whether address " + address + " has balance...");
  const coins = await suiClient.getCoins({
      owner: address,
  });
  //loop over coins
  let totalBalance = 0;
  for (const coin of coins.data) {
      totalBalance += parseInt(coin.balance);
  }
  totalBalance = totalBalance / 1000000000;  //Converting MIST to SUI
  setUserBalance(totalBalance);
  console.log("total balance = ", totalBalance);
  return enoughBalance(totalBalance);
}

function enoughBalance(userBalance: number) {
  return userBalance > MINIMUM_BALANCE;
}

function getTestnetAdminSecretKey() {
  return process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY;
}


async function giveSomeTestCoins(address: string) {
  setError(null);
  console.log("Giving some test coins to address " + address);
  setTransactionInProgress(true);
  const adminPrivateKey = getTestnetAdminSecretKey();
  if (!adminPrivateKey) {
      createRuntimeError("Admin Secret Key not found. Please set NEXT_PUBLIC_ADMIN_SECRET_KEY environment variable.");
      return
  }
  let adminPrivateKeyArray = Uint8Array.from(Array.from(fromB64(adminPrivateKey)));
  const adminKeypair = Ed25519Keypair.fromSecretKey(adminPrivateKeyArray.slice(1));
  const tx = new TransactionBlock();
  const giftCoin = tx.splitCoins(tx.gas, [tx.pure(30000000)]);

  tx.transferObjects([giftCoin], tx.pure(address));

  const res = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: adminKeypair,
      requestType: "WaitForLocalExecution",
      options: {
          showEffects: true,
      },
  });
  const status = res?.effects?.status?.status;
  if (status === "success") {
      console.log("Gift Coin transfer executed! status = ", status);
      checkIfAddressHasBalance(address);
      setTransactionInProgress(false);
  }
  if (status == "failure") {
      createRuntimeError("Gift Coin transfer Failed. Error = " + res?.effects);
  }
}





  

  async function loadRequiredData(encodedJwt: string) {
    //Decoding JWT to get useful Info
    const decodedJwt: LoginResponse = await jwtDecode(encodedJwt!) as LoginResponse;

    setSubjectID(decodedJwt.sub);
    //Getting Salt
    const userSalt = await getSalt(decodedJwt.sub, encodedJwt);
    if (!userSalt) {
        createRuntimeError("Error getting userSalt");
        return;
    }

    //Generating User Address
    const address = jwtToAddress(encodedJwt!, BigInt(userSalt!));

    setUserAddress(address);
    setUserSalt(userSalt!);
    const hasEnoughBalance = await checkIfAddressHasBalance(address);
    if(!hasEnoughBalance){
        await giveSomeTestCoins(address);
        toast.success("We' ve fetched some coins for you, so you can get started with Sui !", {   duration: 8000,} );
    }

    console.log("All required data loaded. ZK Address =", address);
 
}

useLayoutEffect(() => {
  if (typeof window !== 'undefined') {
  setError(null);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const jwt_token_encoded = hash.get("id_token");

  const userKeyData: UserKeyData = JSON.parse(localStorage.getItem("userKeyData")!);

  if (!jwt_token_encoded) {
      createRuntimeError("Could not retrieve a valid JWT Token!")
      return;
  }

  if (!userKeyData) {
      createRuntimeError("user Data is null");
      return;
  }
  localStorage.setItem("id_token", jwt_token_encoded);

  setJwtEncoded(jwt_token_encoded);

  loadRequiredData(jwt_token_encoded);
}
 

}, []);

if (typeof window !== 'undefined') {
  console.log("localstorage", localStorage.getItem("id_token"))
}





  // -------------------------------------------------------------------------------------------------------------------------------



  if (connectionStatus === 'connected' && currentWallet.accounts.length > 0) {
    console.log('Connected Wallet Address:', currentWallet.accounts[0].address);
  }




  const handleDrawCardAndFetchreading = async () => {
    setLoading(true);

    try {
      
      const tx = new TransactionBlock();  
      const packageObjectId = "0xaac3657009b97086a1ecd86d73763a50d730034b5f6f4b3765b57ff8304db3a5";
      tx.moveCall({
        target: `${packageObjectId}::mystic::draws_card`,
        arguments: [tx.object('0x8')],
      });
      const drawResponse = await currentWallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
      });

      console.log("Drawn Card Transaction:", drawResponse);

      const card = drawResponse.events[2].data.card;
      const position = drawResponse.events[2].data.position;

      setcardimage(drawResponse.events[2].data.card_uri);
      setDrawnCard(drawResponse.events[2].data.card);
      setposition(drawResponse.events[2].data.position);


      const requestBody = {
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `You are a Major Arcana Tarot reader. Client asks this question “${description}” and draws the “${card}” card in “${position}” position. Interpret to the client in no more than 150 words.`,
          },
        ],
      };
      
      let apiKey = process.env.NEXT_PUBLIC_API_KEY;
      const baseURL = "https://api.openai.com/v1/chat/completions";
      const headers = new Headers();
      headers.append("Content-Type", "application/json");
      headers.append("Accept", "application/json");
      headers.append(
        "Authorization",
        `Bearer ${apiKey}`
      );
      const readingResponse = await fetch(baseURL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody),
      });
  

      if (!readingResponse.ok) {
        throw new Error("Failed to fetch reading");
      }

      const readingData = await readingResponse.json();
      setLyrics(readingData.choices[0].message.content);
      console.log(readingData);
      console.log("Data to send in mint:", card, position);

    } catch (error) {
      console.error("Error handling draw card and fetching reading:", error);
    } finally {
      setLoading(false);
    }
  };

  const mintreading = async () => {
    const wallet = Cookies.get("tarot_wallet");
    setLoading(true);

    try {

      const tx = new TransactionBlock();  
      const packageObjectId = "0xaac3657009b97086a1ecd86d73763a50d730034b5f6f4b3765b57ff8304db3a5";
      tx.moveCall({
        target: `${packageObjectId}::mystic::mint_card`,
        arguments: [description, lyrics, drawnCard, position],
      });
      const mintResponse = await currentWallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
      });

      console.log("Mint Card Transaction:", mintResponse);
      setmintdone(true);
    } catch (error) {
      console.error("Error handling draw card and fetching rap lyrics:", error);
    } finally {
      setLoading(false);
    }
  };
  function createRuntimeError(message: string) {
    setError(message);
    console.log(message);
    setTransactionInProgress(false);
}


  return (
    <main
      className="flex min-h-screen flex-col items-center justify-between lg:p-24 p-10"
      style={{
        backgroundImage: "url(/tarot_design_dark.png)", // Path to your background image
        backgroundSize: "cover", // Adjust as needed
        backgroundPosition: "center", // Adjust as needed
      }}
    >
      <div className="z-10 lg:max-w-6xl w-full justify-between font-mono text-sm lg:flex md:flex">
        <p
          className="text-white text-xl pb-6 backdrop-blur-2xl dark:border-neutral-800 dark:from-inherit rounded-xl p-4"
          style={{
            backgroundColor: "#1F2544",
            boxShadow: "inset -10px -10px 60px 0 rgba(255, 255, 255, 0.4)",
          }}
        >
          Tarot Reading
        </p>
        <div
          // className="rounded-lg px-2 py-2 lg:mt-0 md:mt-0 mt-4"
          // style={{
          //   backgroundColor: "#F1FFAB",
          //   boxShadow: "inset -10px -10px 60px 0 rgba(255, 255, 255, 0.4)",
          // }}
        >
          <Navbar />
        </div>
      </div>

      <div className="lg:flex md:flex gap-10">
        <div>
          {!ques &&  (
            <button
              onClick={() => {
                setques(true);
              }}
              className="bg-white rounded-lg py-2 px-8 text-black mt-40 font-bold"
            >
              Ask question
            </button>
          )}

          {ques && (currentWallet || localStorage.getItem("id_token")!=null) && (
            <div
              className="px-10 py-10 bgcolor rounded-2xl mt-10 max-w-xl"
              style={{
                border: "1px solid #0162FF",
                boxShadow: "inset -10px -10px 60px 0 rgba(255, 255, 255, 0.4)",
              }}
            >
              {!lyrics && (
                <>
                  <input
                    type="text"
                    placeholder="Write your question here"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="p-2 rounded-lg w-full focus:outline-none"
                  />
                  <button
                    onClick={handleDrawCardAndFetchreading}
                    className="mt-20 bg-black rounded-lg py-2 px-8 text-white"
                  >
                    Get my reading
                  </button>
                </>
              )}
              <div>
                {lyrics && (
                  <div>
                    <div className="flex gap-4 pb-8">
                      <button
                        onClick={() => {
                          setques(true);
                          setDrawnCard(null);
                          setLyrics("");
                        }}
                        className="bg-black rounded-lg py-2 px-8 text-yellow-200"
                      >
                        Start Again
                      </button>

                      <button
                        onClick={mintreading}
                        className="bg-yellow-100 rounded-lg py-2 px-6 text-black font-semibold"
                      >
                        Mint reading
                      </button>
                    </div>
                    <h2 className="font-bold mb-2 text-white">
                      Your Tarot Reading:
                    </h2>
                    <p className="text-white">{lyrics}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {drawnCard && lyrics ? (
          <div>
            <h2 className="mt-10 mb-4 ml-20 text-white">{drawnCard}</h2>
            {position === "upright" ? (
              <img
                src={`${"https://nftstorage.link/ipfs"}/${
                  cardimage.split("ipfs://")[1].replace("jpg", "png")
                }`}
                width="350"
                height="350"
              />
            ) : (
              <img
                src={`${"https://nftstorage.link/ipfs"}/${
                  cardimage.split("ipfs://")[1].replace("jpg", "png")
                }`}
                width="350"
                height="350"
                style={{ transform: "rotate(180deg)" }}
              />
            )}
          </div>
        ) : (
          <div className="rounded-lg mt-10">
            <img src="/tarot_card.jpg" className="w-full"/>
          </div>
        )}
      </div>

      {ques && (!currentWallet || localStorage.getItem("id_token")==null)&& (
        <div
          style={{ backgroundColor: "#222944E5" }}
          className="flex overflow-y-auto overflow-x-hidden fixed inset-0 z-50 justify-center items-center w-full max-h-full"
          id="popupmodal"
        >
          <div className="relative p-4 lg:w-1/3 w-full max-w-2xl max-h-full">
            <div className="relative rounded-lg shadow bg-black text-white">
              <div className="flex items-center justify-end p-4 md:p-5 rounded-t dark:border-gray-600">
                <button
                  onClick={() => setques(false)}
                  type="button"
                  className="text-white bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                >
                  <svg
                    className="w-3 h-3"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 14 14"
                  >
                    <path
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                    />
                  </svg>
                  <span className="sr-only">Close modal</span>
                </button>
              </div>

              {/* <Image src={emoji} alt="info" className="mx-auto"/> */}

              <div className="p-4 space-y-4">
                <p className="text-2xl text-center font-bold" style={{color:'#FFB000'}}>
                Please connect your Sui Wallet
                </p>
              </div>
            <div>
              <a href={loginUrl!}
                   className="hover:text-blue-600"
                   target="_blank">

                    <button
                        className="bg-white text-gray-700 hover:text-gray-900 font-semibold py-2 px-4 border rounded-lg flex items-center space-x-2">
                        <span>Login with Google</span>
                    </button>
                </a>
             </div>
              <div className="flex items-center p-4 rounded-b pb-20 pt-10 justify-center">
                {/* <button
                  type="button"
                  className="w-1/2 mx-auto text-black bg-white font-bold focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg text-md px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                > */}
                  <Navbar />
                {/* </button> */}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* <div className="mb-32 text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left flex justify-center">

        <div
          className="group rounded-lg border border-transparent bg-white px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Deploy{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50 text-balance`}>
            Instantly deploy your Next.js site to a shareable URL with Vercel.
          </p>
        </div>
      </div> */}

      {mintdone && (
        <div
          style={{ backgroundColor: "#222944E5" }}
          className="flex overflow-y-auto overflow-x-hidden fixed inset-0 z-50 justify-center items-center w-full max-h-full"
          id="popupmodal"
        >
          <div className="relative p-4 lg:w-1/3 w-full max-w-2xl max-h-full">
            <div className="relative rounded-lg shadow bg-black text-white">
              <div className="flex items-center justify-end p-4 md:p-5 rounded-t dark:border-gray-600">
                <button
                  onClick={() => setmintdone(false)}
                  type="button"
                  className="text-white bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                >
                  <svg
                    className="w-3 h-3"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 14 14"
                  >
                    <path
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                    />
                  </svg>
                  <span className="sr-only">Close modal</span>
                </button>
              </div>

              {/* <Image src={emoji} alt="info" className="mx-auto"/> */}

              <div className="p-4 space-y-4">
                <p className="text-3xl text-center font-bold text-green-500">
                  Successfully Minted!!
                </p>
                <p className="text-sm text-center pt-4">
                  Go to your profile to view your minted NFTs
                </p>
              </div>
              <div className="flex items-center p-4 rounded-b pb-20">
                <Link href="/profile"
                  type="button"
                  className="w-1/2 mx-auto text-black bg-white font-bold focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg text-md px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                >
                  My Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div
          style={{ backgroundColor: "#222944E5" }}
          className="flex overflow-y-auto overflow-x-hidden fixed inset-0 z-50 justify-center items-center w-full max-h-full"
          id="popupmodal"
        >
          <div className="relative p-4 lg:w-1/5 w-full max-w-2xl max-h-full">
            <div className="relative rounded-lg shadow">
              <div className="flex justify-center gap-4">
                <img
                  className="w-50 h-40"
                  src="/loader.gif"
                  alt="Loading icon"
                />

                {/* <span className="text-white mt-2">Loading...</span> */}
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
