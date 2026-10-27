import CredentialForm from '../components/CredentialForm'
import { RegisterAuthLayout } from './authLayout'
export default function Page() { return <RegisterAuthLayout title="找回密码" subtitle={window.__CRA1_RUNTIME__?.common?.website_name || '会员中心'}><CredentialForm kind="forget" /></RegisterAuthLayout> }
