import React from "react"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import pkg from "../../../../package.json"
import { useAppSelector } from "../hooks"
import { authenticateUser } from "../network"
import Login from "./component/auth/login"
import { Modal } from "./component/modal/modal"
import { setErrorAlertMessage } from "../stores/NetworkStore"
import { useAppDispatch } from "../hooks"
import "./auth.css"

export default function Auth() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const networkError = useAppSelector((state) => state.network.error)
  const isSupposedlyMobile =
    navigator.maxTouchPoints > 0 &&
    window.matchMedia("(orientation: portrait)").matches

  return (
    <div className="auth-page">
      {isSupposedlyMobile && (
        <p className="mobile-warning">{t("auth.mobile_warning")}</p>
      )}
      <img className="logo" src="assets/ui/AutoSpire.png" />
      <header>
        <h1>Pokemon Auto Spire</h1>
        <div className="disclaimer">
          <p>{t("auth.nintendo_warning")}</p>
        </div>
      </header>
      <main>
        <Login />
        <div style={{ marginTop: "12px" }}>
          <button
            className="bubbly"
            onClick={() => {
              authenticateUser()
              navigate("/lobby")
            }}
            style={{ backgroundColor: "#555" }}
          >
            Play as Guest
          </button>
        </div>
      </main>
      <div className="media">
        <span>V1.3</span>
        <p>
          Made by a fan of a mod made by 2 fans, for fans
          <br />
          {t("auth.non_profit")} / {t("auth.open_source")}
          <br />
          {t("auth.copyright")}
          <br />
          A mod of Pokemon Auto Chess — all credit to the original developers
          <br />
          Built on Pokemon Auto Chess v6.9 (master@01c2ebe)
        </p>
        <a
          href="https://discord.gg/cfytB2kA"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", borderRadius: "6px",
            background: "#5865F2", color: "white", textDecoration: "none",
            fontWeight: "bold", fontSize: "14px"
          }}
        >
          <img src="assets/ui/discord.svg" alt="" style={{ width: 20, height: 20 }} />
          Discord
        </a>
      </div>
      <Modal
        show={networkError != null}
        onClose={() => {
          dispatch(setErrorAlertMessage(null))
        }}
        className="is-dark basic-modal-body"
        body={<p style={{ padding: "1em" }}>{networkError}</p>}
      />
    </div>
  )
}
