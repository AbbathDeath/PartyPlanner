import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { UserAuth } from '../Context/AuthContext';

const SignUpPage = () => {
    const [email, setEmail] = useState(""); 
    const [password, setPassword] = useState(""); 
    const [error, setError] = useState(""); 
    const [loading, setLoading] = useState(""); 

    const { session, signUpNewUser } = UserAuth();
    const navigate = useNavigate()
    console.log(session);
    console.log(email. password);

    const handleSignUp = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            const result = await signUpNewUser(email, password)

            if(result.success) {
                navigate('/dashboard')
            }

        } catch(err) {
            setError("Błąd");
        } finally {
            setLoading(false)
        }

    };

    return (
        <div>
            <form onSubmit={handleSignUp} className='max-w-md m-auto pt-24'>
                <h2 className='font-bold pb-2'>Rejestracja</h2>
                <p>
                    Masz już konto? <Link to='/signin'>Zaloguj się</Link>
                </p>

                <div className='flex flex-col py-4'>
                    <input onChange={(e) => setEmail(e.target.value)} 
                        placeholder='Email' 
                        className='p-3 mt-6' 
                        type='email'>

                    </input>
                    <input 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder='Hasło' 
                        className='p-3 mt-6' 
                        type='password'>
                    </input>
                    <button 
                        type='submit' 
                        disabled={loading} 
                        className='mt-6 w-full'>
                        Zarejestruj
                    </button>
                    {error && <p className="text-red-600 text-center pt-4">{error}</p>}
                </div>

            </form>
        </div>
    )
}

export default SignUpPage