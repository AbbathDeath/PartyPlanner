const testowa_tabela = [
    { id: 1, title: "Pizza", amount: 6000},
    { id: 2, title: "Piwko", amount: 4000},
    { id: 3, title: "Inne zakupy", amount: 12000}
]

const formatPLN = (grosze) =>
    (grosze / 100).toLocaleString('pl-PL', {style: 'currency', currency: 'PLN'})

const ExpensesPage = () => {
  return (
    <div className="max-w-md mx-auto pt-24">
      <div className="border rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">Wydatki</h1>

        <ul className="flex flex-col gap-1">
            {testowa_tabela.map((item) => (
                <li key={item.id} className="flex justify-between border-b py-1">
                    <span>{item.title}</span>
                    <span>{formatPLN(item.amount)}</span>
                </li>
            ))}
        </ul>
      </div>
    </div>
  )
}

export default ExpensesPage