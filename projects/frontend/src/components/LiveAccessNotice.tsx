import { Link } from 'react-router-dom'

interface LiveAccessNoticeProps {
  title?: string
  body?: string
}

export const LiveAccessNotice = ({
  title = 'Live Chain Access Required',
  body = 'This action uses protected BFF endpoints and on-chain writes. Connect wallet and sign in to continue.',
}: LiveAccessNoticeProps) => (
  <section className="live-access-notice">
    <strong>{title}</strong>
    <p>{body}</p>
    <Link className="btn btn-primary" to="/connect">
      Enable Live Chain Access
    </Link>
  </section>
)
