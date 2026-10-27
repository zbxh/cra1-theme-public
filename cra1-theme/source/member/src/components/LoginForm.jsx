import CredentialForm from './CredentialForm'
import { RegisterAuthLayout } from '../pages/authLayout'
export default function LoginForm() {
  return <RegisterAuthLayout kind="login"><CredentialForm kind="login" /></RegisterAuthLayout>
}
