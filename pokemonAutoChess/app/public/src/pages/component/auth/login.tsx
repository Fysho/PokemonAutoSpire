import "firebase/compat/auth"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { firebase } from "../../../network"
import { useAppDispatch, useAppSelector } from "../../../hooks"
import { logIn, logOut, setProfile } from "../../../stores/NetworkStore"
import { Role } from "../../../../../types"
import { StyledFirebaseAuth } from "./styled-firebase-auth"

import "firebaseui/dist/firebaseui.css"
import "./login.css"

export default function Login() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const uid = useAppSelector((state) => state.network.uid)
  const displayName = useAppSelector((state) => state.network.displayName)
  const email = useAppSelector((state) => state.network.email)
  const [loggingOut, setLoggingOut] = useState(false)

  const uiConfig = {
    signInFlow: "popup",
    signInOptions: [
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      {
        provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
        requireDisplayName: true
      }
    ],
    callbacks: {
      signInSuccessWithAuthResult: () => false
    }
  }

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((u) => {
      if (u) {
        dispatch(logIn(u))
        dispatch(setProfile({
          uid: u.uid,
          displayName: u.displayName || "Player",
          avatar: "0019/Normal",
          elo: 1000, maxElo: 1000, games: 0, wins: 0, exp: 0, level: 1,
          donor: false, titles: [], title: "", role: Role.BASIC,
          pokemonCollection: {}, booster: 0, eventPoints: 0, maxEventPoints: 0,
          eventFinishTime: null, language: "en", twitchInfo: null
        } as any))
      }
    })
    return () => unsubscribe()
  }, [])

  if (!uid) {
    return (
      <div id="play-panel">
        <StyledFirebaseAuth
          uiConfig={uiConfig}
          firebaseAuth={firebase.auth()}
        />
      </div>
    )
  } else {
    return (
      <div id="play-panel">
        <p>
          {t("auth.authenticated_as")}:{" "}
          <span title={`${displayName}${email ? ` (${email})` : ""}`}>
            {t("auth.hover_to_reveal")}
          </span>
        </p>
        <ul className="actions">
          <li>
            <button
              className="bubbly green"
              onClick={() => navigate("/lobby")}
            >
              Play
            </button>
          </li>
          <li>
            <button
              className="bubbly red"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true)
                try {
                  await firebase.auth().signOut()
                  dispatch(logOut())
                } finally {
                  setLoggingOut(false)
                }
              }}
            >
              {loggingOut ? t("auth.signing_out") : t("auth.sign_out")}
            </button>
          </li>
        </ul>
      </div>
    )
  }
}
