import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppSelector } from "../../../hooks"
import { firebase } from "../../../network"
import { useAppDispatch } from "../../../hooks"
import { logOut } from "../../../stores/NetworkStore"
import { useNavigate } from "react-router"

export function AccountTab() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const uid = useAppSelector((state) => state.network.uid)
  const email = useAppSelector((state) => state.network.email)
  const isGuest = !uid || uid === "local-player"
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div>
      <h3>Account</h3>
      {isGuest ? (
        <p>Playing as guest. Sign in to save your progress.</p>
      ) : (
        <>
          <p style={{ opacity: 0.7, fontSize: "12px" }}>UID: {uid}</p>
          {showDetails ? (
            <p>{email || "Signed in"}</p>
          ) : (
            <p>
              <span
                onClick={() => setShowDetails(true)}
                style={{ cursor: "pointer", color: "#3498db", textDecoration: "underline", fontSize: "13px" }}
              >
                Click to reveal account details
              </span>
            </p>
          )}
        </>
      )}
      <div style={{ marginTop: "12px" }}>
        {isGuest ? (
          <button
            className="bubbly blue"
            onClick={() => navigate("/")}
          >
            Sign In
          </button>
        ) : (
          <button
            className="bubbly red"
            onClick={async () => {
              await firebase.auth().signOut()
              dispatch(logOut())
              navigate("/")
            }}
          >
            Sign Out
          </button>
        )}
      </div>
    </div>
  )
}
