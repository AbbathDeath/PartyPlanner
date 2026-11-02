import { UserAuth } from '../Context/AuthContext'
import {useNavigate} from "react-router"

const Dashboard = () => {
const {session, signOut} = UserAuth();
const navigate = useNavigate();

const handleSignOut = async (e) => {
    e.preventDefault();
    await signOut();
    navigate("/signin");
   
};

    return (
        <div>
            <h1>Panel główny</h1>
            <h2>Witaj, {session?.user?.email}</h2>
            <div>
                <button
                    onClick={handleSignOut}
                    className='hover:cursor-pointer border inline-block px-4 py-3 mt-4'>
                    Wyloguj się
                    </button>
            </div>
        </div>
    )
}

export default Dashboard