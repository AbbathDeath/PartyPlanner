import {Link, useParams } from 'react-router'
import { useState } from 'react'


const test_names = [
    {id: "n1", name: "test1" },
    {id: "n2", name: "test2" },
    {id: "n3", name: "test3" },

]

const test_orders = [
    { id: 1, title: "Pizza", amount: 6000, paid_by: "n1"},
    { id: 2, title: "Piwko", amount: 4000,  paid_by: "n2"},
    { id: 3, title: "Inne zakupy", amount: 12000, paid_by: "n3"}
]

const formatPLN = (grosze) =>
    (grosze / 100).toLocaleString('pl-PL', {style: 'currency', currency: 'PLN'})



const ExpensesPage = () => {

    const { id } = useParams() 
    const [showForm, setShowForm] = useState(false) 

  return (
    <div className="max-w-md mx-auto pt-24">
      <div className="border rounded-lg shadow-md p-6">
        <Link to={`/groups/${id}`}className="text-green-600 underline hover:text-green-800 mt-4">
                    ← Wróć do grupy
                </Link>
        <h1 className="text-2xl font-bold mt-4">Wydatki</h1>

        <ul className="flex flex-col gap-1 mt-4">
            {test_orders.map((order) => (
                <li key={order.id} className="flex justify-between border-b py-1">
                    <div>
                        <div>{order.title}</div>
                        <div className="text-sm text-gray-600">
                            zapłacił(a): {test_names.find((item) => item.id === order.paid_by)?.name}
                        </div>
                    </div>
                    <span>{formatPLN(order.amount)}</span>
                </li>
            ))}
        </ul>

        <button onClick = {() => setShowForm(!showForm)} className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 cursor-pointer" >
            {showForm ? "Anuluj" : "Dodaj wydatek"}
        </button>

        {showForm && (
            <div className="border rounded-lg p-4 mt-4">
                Tu będzie formularz
            </div>
        )}

      </div>
    </div>
  )
}

export default ExpensesPage